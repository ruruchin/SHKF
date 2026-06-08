import { createClient } from '@supabase/supabase-js';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { SUPABASE_CONFIG } from '../shared/supabase-config.js';

function readEnv(name) {
  return process.env[name] || process.env[`VITE_${name}`] || '';
}

export function isSupabaseNetworkError(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || err?.cause?.code || '');
  return /fetch failed|network|timeout|aborted|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|Connect Timeout|AbortError/i.test(msg)
    || /^UND_ERR_/.test(code);
}

function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const { timeoutMs: _drop, ...rest } = options;
  const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : 25000;
  const signals = [];
  if (rest.signal) signals.push(rest.signal);
  if (typeof AbortSignal.timeout === 'function') {
    signals.push(AbortSignal.timeout(ms));
  } else {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), ms);
    signals.push(ac.signal);
  }
  const signal = signals.length > 1 && typeof AbortSignal.any === 'function'
    ? AbortSignal.any(signals)
    : signals[signals.length - 1];
  return fetch(url, { ...rest, signal });
}

export const SUPABASE_OFFLINE_HINT =
  'Supabase недоступен (сеть или таймаут). Проверьте интернет/VPN. Локальные функции работают без облака.';

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
    this.emailDomain = (readEnv('EMPLOYEE_EMAIL_DOMAIN') || SUPABASE_CONFIG.emailDomain || 'shkf.local').toLowerCase();
    this.client = null;
    this.session = null;
    this.profile = null;
    this._restAuthToken = null;
    this._sessionEnsuredAt = 0;

    if (this.isConfigured()) {
      this.client = createClient(this.supabaseUrl, this.supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: (url, options = {}) => fetchWithTimeout(url, options, 25000),
        },
      });
      this.clearStoredSession();
    }
  }

  /** Каждый запуск — с чистого листа, без автологина из auth-session.json. */
  clearStoredSession() {
    this.session = null;
    this.profile = null;
    this._restAuthToken = null;
    try {
      if (existsSync(this.sessionPath)) {
        writeFileSync(this.sessionPath, '{}', 'utf-8');
      }
    } catch {
      /* ignore */
    }
  }

  /** Применить JWT к PostgREST/Storage без сетевого auth.setSession (быстрый путь после рестарта). */
  applyRestAuth() {
    const token = String(this.session?.access_token || '').trim();
    if (!this.client || !token) return false;
    if (this._restAuthToken === token) return true;
    const authHeader = `Bearer ${token}`;

    const setHeader = (headers) => {
      if (!headers) return;
      if (typeof headers.set === 'function') {
        headers.set('Authorization', authHeader);
        return;
      }
      headers.Authorization = authHeader;
    };

    setHeader(this.client.rest?.headers);
    setHeader(this.client.storage?.headers);
    this._restAuthToken = token;
    return true;
  }

  isConfigured() {
    return !!(this.supabaseUrl && this.supabaseAnonKey);
  }

  ensureConfigured() {
    if (!this.client) {
      throw new Error('Supabase не настроен. Заполните SUPABASE_URL и SUPABASE_ANON_KEY.');
    }
  }

  persistSession(session) {
    if (session) {
      // Токены держим только в памяти до закрытия приложения.
      return;
    }
    mkdirSync(this.userDataPath, { recursive: true });
    try {
      writeFileSync(this.sessionPath, '{}', 'utf-8');
    } catch {
      /* ignore */
    }
  }

  async refreshSession() {
    if (!this.session?.refresh_token) return null;
    this.ensureConfigured();
    try {
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
      this.applyRestAuth();
      return this.session;
    } catch (err) {
      if (isSupabaseNetworkError(err)) return this.session;
      throw err;
    }
  }

  buildOfflineSessionResponse() {
    const user = this.session?.user;
    if (!this.profile && user) {
      this.profile = buildFallbackProfile(user);
    }
    return {
      ok: true,
      configured: true,
      offline: true,
      networkError: true,
      message: SUPABASE_OFFLINE_HINT,
      session: this.session ? { expires_at: this.session.expires_at } : null,
      user: safeUser(user),
      profile: this.profile,
    };
  }

  async getSession() {
    if (!this.isConfigured()) {
      return { ok: false, configured: false, session: null, user: null, profile: null };
    }
    try {
      if (this.session) {
        const expiresAt = Number(this.session.expires_at || 0) * 1000;
        if (expiresAt && expiresAt - Date.now() < 60_000) {
          try {
            await this.refreshSession();
          } catch (err) {
            if (isSupabaseNetworkError(err) && this.session) {
              return this.buildOfflineSessionResponse();
            }
            throw err;
          }
        } else {
          await this.ensureClientSession();
        }
      }
      if (this.session && !this.profile) {
        try {
          await this.fetchProfile();
        } catch (err) {
          if (isSupabaseNetworkError(err)) {
            this.profile = buildFallbackProfile(this.session.user);
          }
        }
      }
      return {
        ok: true,
        configured: true,
        offline: false,
        session: this.session ? { expires_at: this.session.expires_at } : null,
        user: safeUser(this.session?.user),
        profile: this.profile,
      };
    } catch (err) {
      if (isSupabaseNetworkError(err) && this.session) {
        return this.buildOfflineSessionResponse();
      }
      throw err;
    }
  }

  formatAuthError(error) {
    const raw = String(error?.message || error || '').trim();
    const code = String(error?.code || '').toLowerCase();
    if (/invalid login credentials/i.test(raw) || code === 'invalid_credentials') {
      return 'Неверный логин или пароль. Аккаунты создаёт администратор — уточните пароль или попросите сбросить.';
    }
    if (/email not confirmed/i.test(raw)) {
      return 'Email не подтверждён. Обратитесь к администратору.';
    }
    if (/too many requests/i.test(raw)) {
      return 'Слишком много попыток входа. Подождите минуту и попробуйте снова.';
    }
    return raw || 'Ошибка авторизации';
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
    this.applyRestAuth();

    const now = Date.now();
    const expiresAt = Number(this.session.expires_at || 0) * 1000;
    if (this._sessionEnsuredAt && now - this._sessionEnsuredAt < 45_000 && expiresAt - now > 90_000) {
      return true;
    }

    if (expiresAt && expiresAt - now < 60_000) {
      try {
        await this.refreshSession();
      } catch (err) {
        if (isSupabaseNetworkError(err)) {
          this._sessionEnsuredAt = now;
          return true;
        }
        throw err;
      }
      this.applyRestAuth();
    }

    this._sessionEnsuredAt = now;
    return true;
  }

  /** Полная синхронизация с GoTrue (нужна для auth.updateUser). */
  async ensureGoTrueSession() {
    await this.ensureClientSession();
    try {
      const { error } = await this.client.auth.setSession({
        access_token: this.session.access_token,
        refresh_token: this.session.refresh_token,
      });
      if (error) throw error;
      return true;
    } catch (err) {
      if (isSupabaseNetworkError(err)) return this.applyRestAuth();
      throw err;
    }
  }

  async signIn(login, password) {
    this.ensureConfigured();
    const email = this.loginToEmail(login);
    try {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: this.formatAuthError(error) };
      this.session = data.session;
      this.persistSession(this.session);
      this.applyRestAuth();
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
      const message = isSupabaseNetworkError(err)
        ? SUPABASE_OFFLINE_HINT
        : (err?.message || 'Ошибка авторизации');
      return { ok: false, message };
    }
  }

  async signOut() {
    this.session = null;
    this.profile = null;
    this._restAuthToken = null;
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
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', this.session.user.id)
        .maybeSingle();
      if (error) throw error;
      this.profile = data || buildFallbackProfile(this.session.user);
      return this.profile;
    } catch (err) {
      if (isSupabaseNetworkError(err)) {
        this.profile = buildFallbackProfile(this.session.user);
        return this.profile;
      }
      throw err;
    }
  }

  /** Сменить пароль (на экране входа / в профиле) и снять флаг must_change_password. */
  async changePassword(newPassword) {
    this.ensureConfigured();
    if (!this.session?.user?.id) return { ok: false, message: 'Не выполнен вход' };
    const pwd = String(newPassword || '');
    if (pwd.length < 6) return { ok: false, message: 'Пароль должен быть не короче 6 символов' };
    await this.ensureGoTrueSession();
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
  async uploadAvatar(dataUrl, profilePatch = {}) {
    this.ensureConfigured();
    if (!this.session?.user?.id) return { ok: false, message: 'Не выполнен вход' };
    const match = String(dataUrl || '').match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!match) return { ok: false, message: 'Неподдерживаемый формат изображения' };

    try {
      await this.ensureClientSession();
      const userId = this.session.user.id;
      const contentType = match[1].includes('jpeg') || match[1].includes('jpg') ? 'image/jpeg' : match[1];
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 2 * 1024 * 1024) {
        return { ok: false, message: 'Аватар слишком большой — выберите файл поменьше' };
      }

      const filePath = `${userId}/avatar.jpg`;
      const uploadUrl = `${this.supabaseUrl}/storage/v1/object/avatars/${filePath}`;
      const uploadRes = await fetchWithTimeout(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.session.access_token}`,
          apikey: this.supabaseAnonKey,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: buffer,
      }, 90000);

      if (!uploadRes.ok) {
        const detail = await uploadRes.text().catch(() => '');
        const message = detail || uploadRes.statusText || 'Не удалось загрузить файл';
        return { ok: false, message: String(message).slice(0, 240) };
      }

      const { data: pub } = this.client.storage.from('avatars').getPublicUrl(filePath);
      const baseUrl = pub?.publicUrl || '';
      if (!baseUrl) return { ok: false, message: 'Не удалось получить ссылку на аватар' };

      const avatarUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
      const update = { avatar_url: avatarUrl };
      if (profilePatch.full_name !== undefined) {
        update.full_name = String(profilePatch.full_name || '');
      }
      if (profilePatch.position !== undefined) {
        update.position = String(profilePatch.position || '');
      }

      const { data, error: pErr } = await this.client
        .from('profiles')
        .update(update)
        .eq('id', userId)
        .select(PROFILE_COLUMNS)
        .single();
      if (pErr) return { ok: false, message: pErr.message };
      this.profile = data || { ...(this.profile || {}), ...update };
      return { ok: true, avatarUrl, profile: this.profile };
    } catch (err) {
      if (isSupabaseNetworkError(err)) {
        return { ok: false, message: 'Таймаут загрузки аватара. Проверьте интернет и попробуйте ещё раз.' };
      }
      return { ok: false, message: err?.message || 'Не удалось загрузить аватар' };
    }
  }

  async fetchUserSettings() {
    this.ensureConfigured();
    if (!this.session?.user?.id) return { settings: {}, app_state: {} };
    try {
      const { data, error } = await this.client
        .from('user_settings')
        .select('settings,app_state,updated_at')
        .eq('user_id', this.session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data || { settings: {}, app_state: {} };
    } catch (err) {
      if (isSupabaseNetworkError(err)) return { settings: {}, app_state: {} };
      throw err;
    }
  }

  async updateUserSettings(settings, appState = undefined) {
    this.ensureConfigured();
    if (!this.session?.user?.id) return { ok: false, message: 'Не выполнен вход' };
    const existing = await this.fetchUserSettings();
    const mergedSettings = {
      ...(existing?.settings && typeof existing.settings === 'object' ? existing.settings : {}),
      ...(settings && typeof settings === 'object' ? settings : {}),
    };
    const payload = {
      user_id: this.session.user.id,
      settings: mergedSettings,
    };
    if (appState !== undefined) {
      payload.app_state = {
        ...(existing?.app_state && typeof existing.app_state === 'object' ? existing.app_state : {}),
        ...(appState && typeof appState === 'object' ? appState : {}),
      };
    }
    const { data, error } = await this.client
      .from('user_settings')
      .upsert(payload)
      .select('settings,app_state,updated_at')
      .single();
    if (error) return { ok: false, message: error.message };
    return { ok: true, ...data };
  }
}
