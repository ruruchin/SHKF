import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { SUPABASE_CONFIG } from '../shared/supabase-config.js';

function readEnv(name) {
  return process.env[name] || process.env[`VITE_${name}`] || '';
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
  };
}

function buildFallbackProfile(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const rawRole = String(meta.role || '').trim();
  const role = ['designer', 'frontend', 'backend', 'pm', 'full'].includes(rawRole) ? rawRole : 'designer';
  return {
    id: user.id,
    email: user.email || '',
    username: String(meta.username || '').trim() || (user.email || '').split('@')[0] || '',
    full_name: String(meta.full_name || '').trim(),
    position: String(meta.position || '').trim(),
    avatar_url: String(meta.avatar_url || '').trim(),
    role,
    is_active: true,
    must_change_password: meta.must_change_password !== false,
    fallback: true,
  };
}

const PROFILE_COLUMNS = 'id,email,username,full_name,position,avatar_url,role,is_active,must_change_password,created_at,updated_at';

export class AuthService {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.sessionPath = path.join(userDataPath, 'auth-session.json');
    this.supabaseUrl = readEnv('SUPABASE_URL') || SUPABASE_CONFIG.url;
    this.supabaseAnonKey = readEnv('SUPABASE_ANON_KEY') || SUPABASE_CONFIG.anonKey;
    this.emailDomain = (readEnv('EMPLOYEE_EMAIL_DOMAIN') || SUPABASE_CONFIG.emailDomain || 'firuru.local').toLowerCase();
    this.client = null;
    this.session = null;
    this.profile = null;

    if (this.isConfigured()) {
      this.client = createClient(this.supabaseUrl, this.supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
      this.restoreSession();
    }
  }

  isConfigured() {
    return !!(this.supabaseUrl && this.supabaseAnonKey);
  }

  ensureConfigured() {
    if (!this.client) {
      throw new Error('Supabase не настроен. Заполните SUPABASE_URL и SUPABASE_ANON_KEY.');
    }
  }

  restoreSession() {
    try {
      if (!existsSync(this.sessionPath)) return;
      const raw = JSON.parse(readFileSync(this.sessionPath, 'utf-8'));
      if (raw?.access_token && raw?.refresh_token) this.session = raw;
    } catch {
      this.session = null;
    }
  }

  persistSession(session) {
    mkdirSync(this.userDataPath, { recursive: true });
    if (!session) {
      try {
        writeFileSync(this.sessionPath, '{}', 'utf-8');
      } catch {
        /* ignore */
      }
      return;
    }
    writeFileSync(this.sessionPath, JSON.stringify(session, null, 2), 'utf-8');
  }

  async refreshSession() {
    if (!this.session?.refresh_token) return null;
    this.ensureConfigured();
    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: this.session.refresh_token,
    });
    if (error) {
      this.session = null;
      this.profile = null;
      this.persistSession(null);
      return null;
    }
    this.session = data.session;
    this.persistSession(this.session);
    return this.session;
  }

  async getSession() {
    if (!this.isConfigured()) {
      return { ok: false, configured: false, session: null, user: null, profile: null };
    }
    if (this.session) {
      const expiresAt = Number(this.session.expires_at || 0) * 1000;
      if (expiresAt && expiresAt - Date.now() < 60_000) {
        await this.refreshSession();
      }
    }
    if (this.session && !this.profile) {
      await this.fetchProfile().catch(() => null);
    }
    return {
      ok: true,
      configured: true,
      session: this.session ? { expires_at: this.session.expires_at } : null,
      user: safeUser(this.session?.user),
      profile: this.profile,
    };
  }

  /** Логин вида "k.zorenko" -> внутренний email "k.zorenko@<domain>". Email пропускаем как есть. */
  loginToEmail(login) {
    const value = String(login || '').trim().toLowerCase();
    if (!value) return '';
    if (value.includes('@')) return value;
    return `${value}@${this.emailDomain}`;
  }

  /** Привязать текущую сессию к http-клиенту (нужно для updateUser / RLS после рестарта). */
  async ensureClientSession() {
    if (!this.session?.access_token || !this.session?.refresh_token) {
      throw new Error('Не выполнен вход');
    }
    try {
      await this.client.auth.setSession({
        access_token: this.session.access_token,
        refresh_token: this.session.refresh_token,
      });
    } catch {
      /* токен мог протухнуть — операция вернёт ошибку ниже */
    }
  }

  async signIn(login, password) {
    this.ensureConfigured();
    const email = this.loginToEmail(login);
    try {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: error.message };
      this.session = data.session;
      this.persistSession(this.session);
      let profile = null;
      try {
        profile = await this.fetchProfile();
      } catch {
        profile = buildFallbackProfile(data.user);
      }
      if (profile && profile.is_active === false) {
        await this.signOut();
        return { ok: false, message: 'Аккаунт отключен администратором' };
      }
      this.profile = profile;
      return { ok: true, user: safeUser(data.user), profile };
    } catch (err) {
      return { ok: false, message: err?.message || 'Ошибка авторизации' };
    }
  }

  async signOut() {
    this.session = null;
    this.profile = null;
    this.persistSession(null);
    return { ok: true };
  }

  authHeaders() {
    if (!this.session?.access_token) throw new Error('Не выполнен вход');
    return {
      Authorization: `Bearer ${this.session.access_token}`,
      apikey: this.supabaseAnonKey,
    };
  }

  async fetchProfile() {
    this.ensureConfigured();
    if (!this.session?.access_token) return null;
    const { data, error } = await this.client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', this.session.user.id)
      .maybeSingle();
    if (error) throw error;
    this.profile = data || buildFallbackProfile(this.session.user);
    return this.profile;
  }

  /** Сменить пароль (на экране входа / в профиле) и снять флаг must_change_password. */
  async changePassword(newPassword) {
    this.ensureConfigured();
    if (!this.session?.user?.id) return { ok: false, message: 'Не выполнен вход' };
    const pwd = String(newPassword || '');
    if (pwd.length < 6) return { ok: false, message: 'Пароль должен быть не короче 6 символов' };
    await this.ensureClientSession();
    const { error } = await this.client.auth.updateUser({ password: pwd });
    if (error) return { ok: false, message: error.message };

    try {
      await this.client.from('profiles').update({ must_change_password: false }).eq('id', this.session.user.id);
    } catch {
      /* профиль обновится при следующем fetch */
    }
    if (this.profile) this.profile.must_change_password = false;

    try {
      const { data } = await this.client.auth.getSession();
      if (data?.session) {
        this.session = data.session;
        this.persistSession(this.session);
      }
    } catch {
      /* keep current session */
    }
    return { ok: true, profile: this.profile };
  }

  /** Обновить отображаемые поля профиля (ФИО, должность). Роль здесь не меняется. */
  async updateProfile(patch = {}) {
    this.ensureConfigured();
    if (!this.session?.user?.id) return { ok: false, message: 'Не выполнен вход' };
    await this.ensureClientSession();
    const update = {};
    if (patch.full_name !== undefined) update.full_name = String(patch.full_name || '');
    if (patch.position !== undefined) update.position = String(patch.position || '');
    if (!Object.keys(update).length) return { ok: true, profile: this.profile };
    const { data, error } = await this.client
      .from('profiles')
      .update(update)
      .eq('id', this.session.user.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (data) this.profile = data;
    return { ok: true, profile: this.profile };
  }

  /** Загрузить аватар (data:URL) в storage и записать ссылку в профиль. */
  async uploadAvatar(dataUrl) {
    this.ensureConfigured();
    if (!this.session?.user?.id) return { ok: false, message: 'Не выполнен вход' };
    const match = String(dataUrl || '').match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!match) return { ok: false, message: 'Неподдерживаемый формат изображения' };
    const contentType = match[1];
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg').replace('+xml', '').replace('svg', 'svg');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 4 * 1024 * 1024) return { ok: false, message: 'Аватар слишком большой (макс. 4 МБ)' };

    await this.ensureClientSession();
    const userId = this.session.user.id;
    const filePath = `${userId}/avatar_${Date.now()}.${ext || 'png'}`;
    const { error: upErr } = await this.client.storage
      .from('avatars')
      .upload(filePath, buffer, { contentType, upsert: true });
    if (upErr) return { ok: false, message: upErr.message };

    const { data: pub } = this.client.storage.from('avatars').getPublicUrl(filePath);
    const url = pub?.publicUrl || '';
    const { error: pErr } = await this.client.from('profiles').update({ avatar_url: url }).eq('id', userId);
    if (pErr) return { ok: false, message: pErr.message };
    if (this.profile) this.profile.avatar_url = url;
    return { ok: true, avatarUrl: url, profile: this.profile };
  }

  async fetchUserSettings() {
    this.ensureConfigured();
    if (!this.session?.user?.id) return { settings: {}, app_state: {} };
    const { data, error } = await this.client
      .from('user_settings')
      .select('settings,app_state,updated_at')
      .eq('user_id', this.session.user.id)
      .maybeSingle();
    if (error) throw error;
    return data || { settings: {}, app_state: {} };
  }

  async updateUserSettings(settings, appState = undefined) {
    this.ensureConfigured();
    if (!this.session?.user?.id) return { ok: false, message: 'Не выполнен вход' };
    const payload = {
      user_id: this.session.user.id,
      settings: settings || {},
    };
    if (appState !== undefined) payload.app_state = appState || {};
    const { data, error } = await this.client
      .from('user_settings')
      .upsert(payload)
      .select('settings,app_state,updated_at')
      .single();
    if (error) return { ok: false, message: error.message };
    return { ok: true, ...data };
  }
}
