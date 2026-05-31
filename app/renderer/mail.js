(function () {
  let webviewReady = false;
  let loginBusy = false;
  let pendingLoginAfterReload = false;

  function $(id) {
    return document.getElementById(id);
  }

  function getWebview() {
    return $('mail-webview');
  }

  function normalizeBaseUrl(url) {
    const raw = (url || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return '';
    }
  }

  function readCredentials() {
    return {
      baseUrl: normalizeBaseUrl($('mail-base-url')?.value),
      username: $('mail-username')?.value?.trim() || '',
      password: $('mail-password')?.value || '',
    };
  }

  function setStatus(text, ok) {
    const el = $('mail-status-text');
    const dot = $('mail-status-dot');
    const wrap = el?.closest('.webtab-status');
    if (el) {
      const raw = String(text || '');
      if (ok && raw === 'Вход выполнен') {
        el.textContent = '';
        el.append('Вход выполнен');
      } else {
        el.textContent = raw;
      }
    }
    if (dot) dot.classList.toggle('on', !!ok);
    wrap?.classList.toggle('is-online', !!ok);
  }

  function isLoginUrl(url) {
    if (isLoggedInUrl(url)) return false;
    const u = String(url || '').toLowerCase();
    if (!u || u === 'about:blank') return false;
    return u.includes('login') || u.includes('loginop');
  }

  function isLoggedInUrl(url) {
    const u = String(url || '').toLowerCase();
    return u.includes('/user') || u.includes('/mailbox') || u.includes('sogo');
  }

  async function tryAutoLogin(forceCreds) {
    const wv = getWebview();
    if (!wv || loginBusy) return;

    const creds = forceCreds || readCredentials();
    if (!creds.username || !creds.password) return;

    const url = wv.getURL?.() || wv.src || '';
    if (!url || url === 'about:blank') return;
    if (wv.isLoading?.()) return;

    if (!pendingLoginAfterReload && !isLoginUrl(url) && isLoggedInUrl(url)) return;

    const script = await window.api.mailGetLoginScript?.(creds);
    if (!script) return;

    loginBusy = true;
    try {
      const result = await wv.executeJavaScript(script);
      if (result?.ok) {
        setStatus('Вход…', false);
        pendingLoginAfterReload = false;
      }
    } catch {
      /* navigation in progress or DOM not ready */
    } finally {
      setTimeout(() => { loginBusy = false; }, 2500);
    }
  }

  async function reloadMailFresh(creds) {
    const wv = getWebview();
    if (!wv) return;
    const url = `${normalizeBaseUrl(creds?.baseUrl).replace(/\/+$/, '')}/`;
    webviewReady = false;
    pendingLoginAfterReload = true;
    loginBusy = false;
    if (typeof wv.loadURL === 'function') {
      wv.loadURL(url);
    } else {
      wv.src = url;
    }
    setStatus('Загрузка…', false);
  }

  async function loadMailUrl(force) {
    const wv = getWebview();
    if (!wv) return;
    const creds = readCredentials();
    if (!creds.baseUrl) {
      setStatus('Укажите URL сервера', false);
      $('mail-auth')?.classList.remove('hidden');
      return;
    }
    const url = `${creds.baseUrl.replace(/\/+$/, '')}/`;
    const current = wv.getURL?.() || wv.src || '';
    if (force || !current || current === 'about:blank') {
      await reloadMailFresh(creds);
    }
  }

  function bindWebview() {
    const wv = getWebview();
    if (!wv || wv.dataset.bound) return;
    wv.dataset.bound = '1';

    wv.addEventListener('dom-ready', () => {
      webviewReady = true;
      if (pendingLoginAfterReload) tryAutoLogin(readCredentials());
    });

    wv.addEventListener('did-finish-load', () => {
      const url = wv.getURL?.() || '';
      if (url && url !== 'about:blank') {
        if (isLoggedInUrl(url)) {
          setStatus('Вход выполнен', true);
          pendingLoginAfterReload = false;
          $('mail-auth')?.classList.add('hidden');
        } else if (pendingLoginAfterReload) {
          tryAutoLogin(readCredentials());
        } else {
          setStatus('Страница входа', false);
        }
      }
    });

    wv.addEventListener('did-fail-load', (event) => {
      if (event.errorCode === -3) return;
      setStatus(`Ошибка: ${event.errorDescription || event.errorCode}`, false);
    });
  }

  async function saveAndOpen() {
    const creds = readCredentials();
    if (!creds.baseUrl) {
      setStatus('Укажите URL сервера', false);
      $('mail-auth')?.classList.remove('hidden');
      return;
    }
    if (!creds.username || !creds.password) {
      setStatus('Укажите логин и пароль', false);
      return;
    }
    setStatus('Смена аккаунта…', false);
    try {
      await window.api.mailSaveCredentials(creds);
      await window.api.mailClearSession();
      if ($('mail-base-url')) $('mail-base-url').value = creds.baseUrl;
      await reloadMailFresh(creds);
    } catch (err) {
      setStatus(err.message || 'Ошибка', false);
    }
  }

  async function loadSavedCredentials() {
    try {
      const info = await window.api.mailGetInfo();
      const s = info?.settings || {};
      if ($('mail-base-url') && s.baseUrl) $('mail-base-url').value = s.baseUrl;
      if ($('mail-username') && s.username) $('mail-username').value = s.username;
      if ($('mail-password') && s.password) $('mail-password').value = s.password;
      return s;
    } catch {
      return {};
    }
  }

  window.activateMailPage = async function activateMailPage() {
    window.detachMetaskBoard?.();
    bindWebview();
    await loadSavedCredentials();
    const creds = readCredentials();
    if (!creds.baseUrl || !creds.username || !creds.password) {
      $('mail-auth')?.classList.remove('hidden');
      setStatus('Укажите URL, логин и пароль', false);
      return;
    }
    setStatus('Загрузка…', false);
    const wv = getWebview();
    const current = wv?.getURL?.() || wv?.src || '';
    if (!current || current === 'about:blank') {
      await loadMailUrl(true);
    }
  };

  window.detachMailView = function detachMailView() {
    /* webview inside #page-mail */
  };

  function initMail() {
    bindWebview();

    $('mail-save-login')?.addEventListener('click', saveAndOpen);
    $('mail-toggle-auth')?.addEventListener('click', () => {
      $('mail-auth')?.classList.toggle('hidden');
    });
    $('mail-refresh')?.addEventListener('click', () => {
      const wv = getWebview();
      if (wv?.reload) wv.reload();
      else loadMailUrl(true);
      setStatus('Обновление…', false);
    });
    $('mail-open-external')?.addEventListener('click', async () => {
      const creds = readCredentials();
      const url = `${creds.baseUrl.replace(/\/+$/, '')}/`;
      window.api.mailOpenExternal(url);
    });

    loadSavedCredentials();
  }

  window.initMail = initMail;
})();
