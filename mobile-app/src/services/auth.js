import { createClient } from '@supabase/supabase-js';

const SUPABASE_CONFIG = {
  url: 'https://ogkigkcqsyyjgoirdoxs.supabase.co',
  anonKey: 'sb_publishable_pkQYzh-5VdGX8PJ1XSiCpQ_enobrvqK',
  emailDomain: 'firuru.local',
};

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

export const authService = {
  async login({ username, password }) {
    const email = this.loginToEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, message: this.formatAuthError(error) };
    }
    const user = data.user;
    const session = data.session;
    
    // Fetch profile
    const profile = await this.fetchProfile(user.id);
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      return { ok: false, message: 'Аккаунт отключен администратором' };
    }
    
    return { ok: true, user, session, profile };
  },
  
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      return { ok: false, session: null, user: null, profile: null };
    }
    const profile = await this.fetchProfile(session.user.id);
    return { ok: true, session, user: session.user, profile };
  },

  async signOut() {
    await supabase.auth.signOut();
    return { ok: true };
  },
  
  async fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,username,full_name,position,avatar_url,role,is_active,must_change_password')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async changePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, message: error.message };
    
    // update profile must_change_password flag
    try {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', data.user.id);
    } catch (err) {
      console.error('Failed to update must_change_password flag', err);
    }
    
    return { ok: true, user: data.user };
  },

  async fetchUserSettings(userId) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings,app_state')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data || { settings: {}, app_state: {} };
    } catch (err) {
      console.error('Failed to fetch user settings', err);
      return { settings: {}, app_state: {} };
    }
  },

  loginToEmail(login) {
    const value = String(login || '').trim().toLowerCase();
    if (!value) return '';
    if (value.includes('@')) return value;
    return `${value}@${SUPABASE_CONFIG.emailDomain}`;
  },

  formatAuthError(error) {
    const raw = String(error?.message || error || '').trim();
    if (/invalid login credentials/i.test(raw)) {
      return 'Неверный логин или пароль. Обратитесь к администратору.';
    }
    if (/email not confirmed/i.test(raw)) {
      return 'Email не подтверждён. Обратитесь к администратору.';
    }
    return raw || 'Ошибка авторизации';
  }
};
