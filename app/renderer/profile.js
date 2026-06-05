(function () {
  let profile = null;
  let returnTo = 'search';

  const $ = (id) => document.getElementById(id);
  const ROLE_LABELS = {
    designer: 'Дизайнер',
    frontend: 'Front-end',
    backend: 'Back-end',
    pm: 'Project Manager',
    full: 'Все разделы',
  };

  function roleLabel(role) {
    return ROLE_LABELS[role] || role || '—';
  }

  function initials(p) {
    const name = (p?.full_name || '').trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
    }
    const login = p?.username || (p?.email || '').split('@')[0] || '';
    return (login[0] || '?').toUpperCase();
  }

  function setStatus(id, message, kind) {
    const el = $(id);
    if (!el) return;
    el.textContent = message || '';
    el.className = 'pf-status' + (kind ? ` pf-status--${kind}` : '');
  }

  function setProfile(p) {
    profile = p || null;
    if (!p) return;
    const login = p.username || (p.email || '').split('@')[0] || '';
    const displayName = p.full_name || login || '—';
    const displayPosition = p.position || 'Должность не указана';
    const displayRole = roleLabel(p.role);
    if ($('pf-name')) $('pf-name').textContent = displayName;
    if ($('pf-position-line')) $('pf-position-line').textContent = displayPosition;
    if ($('pf-login-chip')) $('pf-login-chip').textContent = `@${login}`;
    if ($('pf-role-chip')) $('pf-role-chip').textContent = displayRole;
    if ($('pf-login-ro')) $('pf-login-ro').textContent = login || '—';
    if ($('pf-role-ro')) $('pf-role-ro').textContent = displayRole;
    if ($('pf-fullname') && document.activeElement !== $('pf-fullname')) $('pf-fullname').value = p.full_name || '';
    if ($('pf-position') && document.activeElement !== $('pf-position')) $('pf-position').value = p.position || '';

    const img = $('pf-avatar-img');
    if (img) {
      if (p.avatar_url) {
        img.style.backgroundImage = `url("${p.avatar_url}")`;
        img.textContent = '';
        img.classList.add('has-img');
      } else {
        img.style.backgroundImage = '';
        img.textContent = initials(p);
        img.classList.remove('has-img');
      }
    }
    syncPreview();
  }

  function paintAvatar(el, p) {
    if (!el || !p) return;
    if (p.avatar_url) {
      el.style.backgroundImage = `url("${p.avatar_url}")`;
      el.textContent = '';
      el.classList.add('has-img');
    } else {
      el.style.backgroundImage = '';
      el.textContent = initials(p);
      el.classList.remove('has-img');
    }
  }

  function syncPreview() {
    if (!profile) return;
    const login = profile.username || (profile.email || '').split('@')[0] || '';
    const name = $('pf-fullname')?.value?.trim() || profile.full_name || login || '—';
    const position = $('pf-position')?.value?.trim() || profile.position || 'Должность не указана';
    if ($('pf-preview-name')) $('pf-preview-name').textContent = name;
    if ($('pf-preview-position')) $('pf-preview-position').textContent = position;
    if ($('pf-preview-login')) $('pf-preview-login').textContent = `@${login || '—'}`;
    if ($('pf-preview-role')) $('pf-preview-role').textContent = roleLabel(profile.role);
    paintAvatar($('pf-preview-avatar'), profile);
  }

  function goBack() {
    const target = document.querySelector(`.nav-item[data-page="${returnTo}"]`) || document.querySelector('.nav-item[data-page]');
    if (target) {
      target.click();
      $('sidebar-user-card')?.classList.remove('is-active');
    }
  }

  function openProfilePage() {
    const page = $('page-profile');
    if (!page) return;
    const current = document.querySelector('.nav-item.active');
    if (current?.dataset.page) returnTo = current.dataset.page;

    window.hideCustomCursor?.();
    window.detachMetaskBoard?.();
    window.detachMailView?.();
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    page.classList.add('active');
    $('sidebar-user-card')?.classList.add('is-active');
    setProfile(profile || window.getAuthState?.()?.profile);
  }

  function resizeImage(file, max = 512) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Не удалось открыть изображение'));
        img.onload = () => {
          let { width, height } = img;
          if (width > max || height > max) {
            const scale = Math.min(max / width, max / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function onAvatarPicked(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const card = $('pf-avatar');
    card?.classList.add('is-uploading');
    try {
      const dataUrl = await resizeImage(file);
      const res = await window.api.authUploadAvatar?.({ dataUrl });
      if (!res?.ok) {
        setStatus('pf-save-status', res?.message || 'Не удалось загрузить аватар', 'error');
        return;
      }
      if (res.profile) {
        setProfile(res.profile);
        window.dispatchEvent(new CustomEvent('user-avatar-updated'));
      }
      setStatus('pf-save-status', 'Аватар обновлён', 'ok');
    } catch (err) {
      setStatus('pf-save-status', err?.message || 'Ошибка загрузки аватара', 'error');
    } finally {
      card?.classList.remove('is-uploading');
    }
  }

  async function saveProfile() {
    const btn = $('pf-save');
    const full_name = $('pf-fullname')?.value?.trim() || '';
    const position = $('pf-position')?.value?.trim() || '';
    if (btn) btn.disabled = true;
    setStatus('pf-save-status', 'Сохраняем…');
    try {
      const res = await window.api.authUpdateProfile?.({ full_name, position });
      if (!res?.ok) {
        setStatus('pf-save-status', res?.message || 'Не удалось сохранить', 'error');
        return;
      }
      if (res.profile) setProfile(res.profile);
      setStatus('pf-save-status', 'Сохранено', 'ok');
    } catch (err) {
      setStatus('pf-save-status', err?.message || 'Ошибка сохранения', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function changePassword() {
    const btn = $('pf-pw-save');
    const pw = $('pf-newpw')?.value || '';
    const pw2 = $('pf-newpw2')?.value || '';
    if (pw.length < 6) {
      setStatus('pf-pw-status', 'Минимум 6 символов', 'error');
      return;
    }
    if (pw !== pw2) {
      setStatus('pf-pw-status', 'Пароли не совпадают', 'error');
      return;
    }
    if (btn) btn.disabled = true;
    setStatus('pf-pw-status', 'Обновляем…');
    try {
      const res = await window.api.authChangePassword?.({ password: pw });
      if (!res?.ok) {
        setStatus('pf-pw-status', res?.message || 'Не удалось обновить пароль', 'error');
        return;
      }
      if ($('pf-newpw')) $('pf-newpw').value = '';
      if ($('pf-newpw2')) $('pf-newpw2').value = '';
      setStatus('pf-pw-status', 'Пароль обновлён', 'ok');
    } catch (err) {
      setStatus('pf-pw-status', err?.message || 'Ошибка', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bind() {
    $('sidebar-user-card')?.addEventListener('click', () => {
      if ($('sidebar-user-card')?.classList.contains('is-empty')) return;
      openProfilePage();
    });
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => $('sidebar-user-card')?.classList.remove('is-active'));
    });
    $('pf-avatar')?.addEventListener('click', () => $('pf-avatar-input')?.click());
    $('pf-avatar-input')?.addEventListener('change', onAvatarPicked);
    $('pf-back')?.addEventListener('click', goBack);
    $('pf-fullname')?.addEventListener('input', syncPreview);
    $('pf-position')?.addEventListener('input', syncPreview);
    $('pf-save')?.addEventListener('click', saveProfile);
    $('pf-pw-save')?.addEventListener('click', changePassword);
    $('pf-logout')?.addEventListener('click', async () => {
      await window.api.authLogout?.();
      location.reload();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.Profile = { setProfile, open: openProfilePage };
})();
