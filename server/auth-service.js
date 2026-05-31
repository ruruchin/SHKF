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
    full_name: String(meta.full_name || '').trim(),
    role,
    is_active: true,
    fallback: true,
  };
}

export class AuthService {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.sessionPath = path.join(userDataPath, 'auth-session.json');
    this.supabaseUrl = readEnv('SUPABASE_URL') || SUPABASE_CONFIG.url;
    this.supabaseAnonKey = readEnv('SUPABASE_ANON_KEY') || SUPABASE_CONFIG.anonKey;
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

  async signIn(email, password) {
    this.ensureConfigured();
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
      .select('id,email,full_name,role,is_active,created_at,updated_at')
      .eq('id', this.session.user.id)
      .maybeSingle();
    if (error) throw error;
    this.profile = data || buildFallbackProfile(this.session.user);
    return this.profile;
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
