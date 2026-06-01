(function () {
  let currentAuth = null;
  let pendingLogin = null; // результат входа, ожидающий смены пароля

  function $(id) {
    return document.getElementById(id);
  }

  function setError(id, message) {
    const el = $(id);
    if (el) el.textContent = message || '';
  }

  function setBusy(btnId, busy, busyText, idleText) {
    const btn = $(btnId);
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? busyText : idleText;
  }

  function showStep(step) {
    $('auth-step-login')?.classList.toggle('hidden', step !== 'login');
    $('auth-step-changepw')?.classList.toggle('hidden', step !== 'changepw');
  }

  function profileInitials(profile) {
    const name = (profile?.full_name || '').trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
    }
    const login = profile?.username || (profile?.email || '').split('@')[0] || '';
    return (login[0] || '?').toUpperCase();
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
        ? `${profile.full_name || profile.username || profile.email || 'Пользователь'} · ${profile.role}`
        : 'Не выполнен вход';
    }
    const roleLabel = $('settings-role-label');
    if (roleLabel) roleLabel.textContent = profile?.role || '—';
    const roleHint = $('settings-role-hint');
    if (roleHint) {
      roleHint.textContent = profile
        ? `Роль аккаунта ${profile.username || profile.email}. Меняется в Supabase.`
        : 'Войдите в аккаунт, чтобы получить роль.';
    }

    updateUserCard(profile);
    window.Profile?.setProfile?.(profile);
  }

  function updateUserCard(profile) {
    const card = $('sidebar-user-card');
    if (!card) return;
    card.classList.toggle('is-empty', !profile);
    const nameEl = $('sidebar-user-name');
    const posEl = $('sidebar-user-position');
    const avatarEl = $('sidebar-user-avatar');
    if (nameEl) nameEl.textContent = profile?.full_name || profile?.username || 'Гость';
    if (posEl) posEl.textContent = profile?.position || (profile ? `@${profile.username || ''}` : 'Не выполнен вход');
    if (avatarEl) {
      if (profile?.avatar_url) {
        avatarEl.style.backgroundImage = `url("${profile.avatar_url}")`;
        avatarEl.classList.add('has-img');
        avatarEl.textContent = '';
      } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.classList.remove('has-img');
        avatarEl.textContent = profile ? profileInitials(profile) : '';
      }
    }
  }

  function finishAuth(result) {
    if (result?.config) {
      window.__APP_CONFIG__ = result.config;
      window.applyTheme?.(result.config.theme || 'dark');
      window.applyAppSettings?.(result.config.settings);
      window.RoleNav?.applyRoleNav?.(result.config.settings?.user?.role || result.profile?.role);
    }
    pendingLogin = null;
    showStep('login');
    applyAuthState(result);
    window.dispatchEvent(new CustomEvent('auth-ready', { detail: result }));
  }

  async function submitLogin(event) {
    event.preventDefault();
    setError('auth-error', '');
    const login = $('auth-login')?.value?.trim() || '';
    const password = $('auth-password')?.value || '';
    if (!login || !password) {
      setError('auth-error', 'Введите логин и пароль.');
      return;
    }

    setBusy('auth-submit', true, 'Входим…', 'Войти');
    try {
      const result = await window.api.authLogin({ login, password });
      if (!result?.ok) {
        setError('auth-error', result?.message || 'Не удалось войти.');
        return;
      }
      if (result.profile?.must_change_password) {
        // Не пускаем в приложение, пока пользователь не задаст свой пароль.
        pendingLogin = result;
        setError('auth-cp-error', '');
        if ($('auth-newpw')) $('auth-newpw').value = '';
        if ($('auth-newpw2')) $('auth-newpw2').value = '';
        showStep('changepw');
        setTimeout(() => $('auth-newpw')?.focus(), 60);
        return;
      }
      finishAuth(result);
    } catch (err) {
      setError('auth-error', err?.message || 'Ошибка связи с сервисом авторизации.');
    } finally {
      setBusy('auth-submit', false, 'Входим…', 'Войти');
    }
  }

  async function submitChangePassword(event) {
    event.preventDefault();
    setError('auth-cp-error', '');
    const pw = $('auth-newpw')?.value || '';
    const pw2 = $('auth-newpw2')?.value || '';
    if (pw.length < 6) {
      setError('auth-cp-error', 'Пароль должен быть не короче 6 символов.');
      return;
    }
    if (pw !== pw2) {
      setError('auth-cp-error', 'Пароли не совпадают.');
      return;
    }

    setBusy('auth-cp-submit', true, 'Сохраняем…', 'Сохранить и войти');
    try {
      const res = await window.api.authChangePassword({ password: pw });
      if (!res?.ok) {
        setError('auth-cp-error', res?.message || 'Не удалось сменить пароль.');
        return;
      }
      const merged = {
        ...(pendingLogin || {}),
        ...res,
        profile: { ...(pendingLogin?.profile || {}), ...(res.profile || {}), must_change_password: false },
        config: res.config || pendingLogin?.config,
      };
      finishAuth(merged);
    } catch (err) {
      setError('auth-cp-error', err?.message || 'Ошибка смены пароля.');
    } finally {
      setBusy('auth-cp-submit', false, 'Сохраняем…', 'Сохранить и войти');
    }
  }

  async function initAuthGate() {
    $('auth-step-login')?.addEventListener('submit', submitLogin);
    $('auth-step-changepw')?.addEventListener('submit', submitChangePassword);
    $('settings-auth-logout')?.addEventListener('click', async () => {
      await window.api.authLogout?.();
      location.reload();
    });

    // Профиль/аватар могли обновиться из другого места — обновим карточку и страницу профиля.
    window.api.onAuthChanged?.((payload) => {
      if (payload?.profile) {
        currentAuth = { ...(currentAuth || {}), profile: payload.profile, user: payload.user };
        updateUserCard(payload.profile);
        window.Profile?.setProfile?.(payload.profile);
      }
    });

    const result = await window.api.authGetSession?.();
    if (result?.config) window.__APP_CONFIG__ = result.config;

    if (result?.profile?.must_change_password) {
      pendingLogin = result;
      document.documentElement.removeAttribute('data-authenticated');
      $('auth-gate')?.classList.remove('hidden');
      showStep('changepw');
      updateUserCard(result.profile);
    } else {
      applyAuthState(result);
    }
    return result;
  }

  window.initAuthGate = initAuthGate;
  window.getAuthState = () => currentAuth;
})();
