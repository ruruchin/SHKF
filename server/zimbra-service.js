function trimSlash(url) {
  return (url || '').replace(/\/+$/, '');
}

export function normalizeZimbraBaseUrl(url) {
  const raw = (url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

export class ZimbraService {
  constructor() {
    this.sessionUserId = '';
    this.partition = 'persist:zimbra-guest';
    this.settings = {
      baseUrl: '',
      username: '',
      password: '',
    };
  }

  setSessionUser(userId = '') {
    const nextId = String(userId || '').trim();
    const nextPartition = nextId ? `persist:zimbra-${nextId}` : 'persist:zimbra-guest';
    if (this.sessionUserId === nextId && this.partition === nextPartition) return;
    this.sessionUserId = nextId;
    this.partition = nextPartition;
  }

  configure(settings = {}) {
    this.settings = {
      baseUrl: normalizeZimbraBaseUrl(settings.baseUrl),
      username: settings.username || '',
      password: settings.password || '',
    };
  }

  getMailUrl() {
    const base = trimSlash(this.settings.baseUrl);
    if (!base) return '';
    return `${base}/`;
  }

  getSessionPartition() {
    return this.partition;
  }

  isLoginPage(url) {
    const u = String(url || '').toLowerCase();
    if (!u || u === 'about:blank') return false;
    if (u.includes('/mail') || u.includes('#mail') || u.includes('app=mail') || u.includes('/user/')) return false;
    if (u.includes('login') || u.includes('loginop')) return true;
    try {
      const base = new URL(this.getMailUrl()).host;
      const parsed = new URL(u);
      if (parsed.host !== base) return false;
      return parsed.pathname === '/' || (parsed.pathname.startsWith('/zimbra') && !parsed.pathname.includes('/mail'));
    } catch {
      return false;
    }
  }

  buildAutoLoginScript(username, password) {
    const u = JSON.stringify(username);
    const p = JSON.stringify(password);
    return `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      let user = ${u};
      const pass = ${p};
      if (!user || !pass) return { ok: false, reason: 'empty' };

      const findUser = () => {
        const sels = [
          '#login_user', 'input[name="login_user"]',
          '#username', '#login', '#loginName',
          'input[name="username"]', 'input[name="login"]',
          'input[type="email"]', 'input[autocomplete="username"]',
        ];
        for (const s of sels) {
          const el = document.querySelector(s);
          if (el && el.type !== 'password') return el;
        }
        return null;
      };

      const findPass = () => {
        const sels = [
          '#pass_user', 'input[name="pass_user"]',
          '#password', 'input[name="password"]',
          'input[type="password"]', 'input[autocomplete="current-password"]',
        ];
        for (const s of sels) {
          const el = document.querySelector(s);
          if (el) return el;
        }
        return null;
      };

      const setVal = (el, val) => {
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      let userEl = null;
      let passEl = null;
      for (let i = 0; i < 8; i += 1) {
        userEl = findUser();
        passEl = findPass();
        if (userEl && passEl) break;
        await sleep(400);
      }
      if (!userEl || !passEl) return { ok: false, reason: 'fields' };

      if (!String(user).includes('@') && userEl.placeholder && userEl.placeholder.toLowerCase().includes('email')) {
        const host = location.hostname.replace(/^[^.]+\./, '');
        if (host.includes('.')) user = user + '@' + host;
      }

      setVal(userEl, user);
      setVal(passEl, pass);
      await sleep(500);

      const btn = document.querySelector(
        'button[type="submit"], input[type="submit"], .ZLoginButton, #Login_button, #loginButton, button.loginButton, button.btn-success'
      );
      if (btn) {
        btn.click();
        return { ok: true, method: 'click', user };
      }
      const form = userEl.closest('form') || passEl.closest('form');
      if (form) {
        form.submit();
        return { ok: true, method: 'submit', user };
      }
      return { ok: false, reason: 'submit' };
    })()`;
  }

  resolveLoginUsername(username) {
    const raw = String(username || '').trim();
    if (!raw || raw.includes('@')) return raw;
    try {
      const host = new URL(this.getMailUrl()).hostname;
      const domain = host.replace(/^[^.]+\./, '');
      if (domain.includes('.')) return `${raw}@${domain}`;
    } catch {
      /* ignore */
    }
    return raw;
  }
}
