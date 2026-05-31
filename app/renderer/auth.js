(function () {
  let currentAuth = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setError(message) {
    const el = $('auth-error');
    if (el) el.textContent = message || '';
  }

  function setBusy(busy) {
    const btn = $('auth-submit');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? 'Входим...' : 'Войти';
  }

  function applyAuthState(auth) {
    currentAuth = auth || null;
    const profile = auth?.profile;
    document.documentElement.toggleAttribute('data-authenticated', !!profile);
    const gate = $('auth-gate');
    gate?.classList.toggle('hidden', !!profile);

    const chip = $('settings-auth-chip');
    if (chip) {
      chip.textContent = profile
        ? `${profile.full_name || profile.email || 'Пользователь'} · ${profile.role}`
        : 'Не выполнен вход';
    }
    const roleLabel = $('settings-role-label');
    if (roleLabel) {
      roleLabel.textContent = profile?.role || '—';
    }
    const roleHint = $('settings-role-hint');
    if (roleHint) {
      roleHint.textContent = profile
        ? `Роль назначена аккаунту ${profile.email}. Меняется в Supabase.`
        : 'Войдите в аккаунт, чтобы получить роль.';
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    setError('');
    const email = $('auth-email')?.value?.trim() || '';
    const password = $('auth-password')?.value || '';
    if (!email || !password) {
      setError('Введите email и пароль.');
      return;
    }

    setBusy(true);
    try {
      const result = await window.api.authLogin({ email, password });
      if (!result?.ok) {
        setError(result?.message || 'Не удалось войти.');
        return;
      }
      if (result.config) {
        window.__APP_CONFIG__ = result.config;
        window.applyTheme?.(result.config.theme || 'dark');
        window.applyAppSettings?.(result.config.settings);
        window.RoleNav?.applyRoleNav?.(result.config.settings?.user?.role || result.profile?.role);
      }
      applyAuthState(result);
      window.dispatchEvent(new CustomEvent('auth-ready', { detail: result }));
    } catch (err) {
      setError(err?.message || 'Ошибка связи с сервисом авторизации.');
    } finally {
      setBusy(false);
    }
  }

  async function initAuthGate() {
    $('auth-form')?.addEventListener('submit', submitLogin);
    $('settings-auth-logout')?.addEventListener('click', async () => {
      await window.api.authLogout?.();
      location.reload();
    });

    const result = await window.api.authGetSession?.();
    if (result?.config) {
      window.__APP_CONFIG__ = result.config;
    }
    applyAuthState(result);
    return result;
  }

  window.initAuthGate = initAuthGate;
  window.getAuthState = () => currentAuth;
})();
