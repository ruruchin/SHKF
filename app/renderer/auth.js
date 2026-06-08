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

  function roleLabel(role) {
    const labels = {
      designer: 'Дизайнер',
      frontend: 'Front-end',
      backend: 'Back-end',
      pm: 'Project Manager',
      full: 'Все разделы',
    };
    return labels[role] || role || '—';
  }

  async function applyAuthState(auth) {
    currentAuth = auth || null;
    const profile = auth?.profile;
    document.documentElement.toggleAttribute('data-authenticated', !!profile);
    if (profile) {
      await window.AuthLive2d?.destroy?.();
    }
    const gate = $('auth-gate');
    gate?.classList.toggle('hidden', !!profile);
    if (!profile) {
      window.AuthLive2d?.scheduleMount?.();
    }

    const chip = $('settings-auth-chip');
    if (chip) {
      chip.textContent = profile
        ? `${profile.full_name || profile.username || profile.email || 'Пользователь'} · ${roleLabel(profile.role)}`
        : 'Не выполнен вход';
    }
    const roleLabelEl = $('settings-role-label');
    if (roleLabelEl) roleLabelEl.textContent = roleLabel(profile?.role);
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
    if (avatarEl && window.Profile?.paintAllAvatars) {
      window.Profile.paintAllAvatars(profile);
      return;
    }
    if (avatarEl) {
      avatarEl.textContent = profile ? profileInitials(profile) : '';
      avatarEl.classList.remove('has-img');
      avatarEl.style.background = '';
      avatarEl.querySelector('.profile-avatar-photo')?.remove();
    }
  }

  async function finishAuth(result) {
    if (result?.config) {
      window.__APP_CONFIG__ = result.config;
      window.applyTheme?.(result.config.theme || 'light');
      window.applyAppSettings?.(result.config.settings);
      window.RoleNav?.applyRoleNav?.(result.config.settings?.user?.role || result.profile?.role);
    }
    pendingLogin = null;
    showStep('login');
    await applyAuthState(result);
    if (result?.user?.id) window.prefetchTeamChatDirectory?.();
    window.dispatchEvent(new CustomEvent('auth-ready', { detail: result }));
  }

  async function submitLogin(event) {
    event.preventDefault();
    setError('auth-error', '');
    const login = $('auth-login')?.value?.trim() || '';
    const password = $('auth-password')?.value || '';
    if (!login || !password) {
      setError('auth-error', 'Введите логин и пароль.');
      window.AuthLive2d?.reactError?.();
      return;
    }

    setBusy('auth-submit', true, 'Входим…', 'Войти');
    try {
      const result = await window.api.authLogin({ login, password });
      if (!result?.ok) {
        setError('auth-error', result?.message || 'Не удалось войти.');
        window.AuthLive2d?.reactError?.();
        return;
      }
      window.AuthLive2d?.reactSuccess?.();
      await window.AuthLive2d?.wait?.(900);
      await finishAuth(result);
    } catch (err) {
      setError('auth-error', err?.message || 'Ошибка связи с сервисом авторизации.');
      window.AuthLive2d?.reactError?.();
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
      window.AuthLive2d?.reactError?.();
      return;
    }
    if (pw !== pw2) {
      setError('auth-cp-error', 'Пароли не совпадают.');
      window.AuthLive2d?.reactError?.();
      return;
    }

    setBusy('auth-cp-submit', true, 'Сохраняем…', 'Сохранить и войти');
    try {
      const res = await window.api.authChangePassword({ password: pw });
      if (!res?.ok) {
        setError('auth-cp-error', res?.message || 'Не удалось сменить пароль.');
        window.AuthLive2d?.reactError?.();
        return;
      }
      const merged = {
        ...(pendingLogin || {}),
        ...res,
        profile: { ...(pendingLogin?.profile || {}), ...(res.profile || {}), must_change_password: false },
        config: res.config || pendingLogin?.config,
      };
      window.AuthLive2d?.reactSuccess?.();
      await window.AuthLive2d?.wait?.(900);
      await finishAuth(merged);
    } catch (err) {
      setError('auth-cp-error', err?.message || 'Ошибка смены пароля.');
      window.AuthLive2d?.reactError?.();
    } finally {
      setBusy('auth-cp-submit', false, 'Сохраняем…', 'Сохранить и войти');
    }
  }

  function bindPasswordEye() {
    const eye = $('auth-eye');
    const input = $('auth-password');
    if (!eye || !input) return;
    eye.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.classList.toggle('is-on', show);
      input.focus();
    });
  }

  async function initAuthGate() {
    $('auth-step-login')?.addEventListener('submit', submitLogin);
    $('auth-step-changepw')?.addEventListener('submit', submitChangePassword);
    bindPasswordEye();
    $('auth-forgot')?.addEventListener('click', () => {
      setError('auth-error', 'Пароль выдаёт администратор — обратитесь к нему для сброса.');
      window.AuthLive2d?.reactError?.();
    });
    $('settings-auth-logout')?.addEventListener('click', async () => {
      await window.api.authLogout?.();
      location.reload();
    });

    // Профиль/аватар могли обновиться из другого места — обновим карточку и страницу профиля.
    window.api.onAuthChanged?.((payload) => {
      if (payload?.profile) {
        applyAuthState({ ...(currentAuth || {}), profile: payload.profile, user: payload.user });
      }
    });

    window.addEventListener('user-avatar-updated', (event) => {
      const nextProfile = event.detail?.profile;
      if (!nextProfile) return;
      applyAuthState({ ...(currentAuth || {}), profile: nextProfile, user: currentAuth?.user });
    });

    // При каждом запуске показываем экран входа — сессия не восстанавливается с диска.
    const result = await window.api.authGetSession?.();
    if (result?.config) window.__APP_CONFIG__ = result.config;
    await applyAuthState(result);
    return result;
  }

  window.initAuthGate = initAuthGate;
  window.getAuthState = () => currentAuth;
})();
