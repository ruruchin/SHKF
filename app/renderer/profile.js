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

    paintAllAvatars(p);
    syncPreview();
  }

  function avatarDisplayUrl(profile, overrideUrl = null) {
    const raw = String(overrideUrl || profile?.avatar_url || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
    if (profile?.updated_at && !/[?&]v=/.test(raw)) {
      const sep = raw.includes('?') ? '&' : '?';
      return `${raw}${sep}v=${encodeURIComponent(profile.updated_at)}`;
    }
    if (!/[?&]v=/.test(raw)) {
      const sep = raw.includes('?') ? '&' : '?';
      return `${raw}${sep}v=${Date.now()}`;
    }
    return raw;
  }

  const AVATAR_PHOTO_CLASS = 'profile-avatar-photo';

  function preloadAvatarUrl(url) {
    const src = String(url || '').trim();
    if (!src) return Promise.resolve(null);
    if (src.startsWith('data:') || src.startsWith('blob:')) return Promise.resolve(src);
    return new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve(src);
      probe.onerror = () => resolve(null);
      probe.src = src;
    });
  }

  function paintAvatar(el, p, { urlOverride = null } = {}) {
    if (!el) return;
    const url = avatarDisplayUrl(p, urlOverride);
    const label = initials(p);
    let img = el.querySelector(`img.${AVATAR_PHOTO_CLASS}`);

    if (!url) {
      img?.remove();
      el.textContent = label;
      el.classList.remove('has-img');
      delete el.dataset.avatarUrl;
      el.style.background = '';
      return;
    }

    if (!img) {
      img = document.createElement('img');
      img.className = AVATAR_PHOTO_CLASS;
      img.alt = '';
      img.draggable = false;
      el.appendChild(img);
    }

    for (const node of [...el.childNodes]) {
      if (node !== img) node.remove();
    }

    el.classList.add('has-img');
    el.dataset.avatarUrl = url;
    el.style.background = '';

    img.onerror = () => {
      img.remove();
      el.textContent = label;
      el.classList.remove('has-img');
      delete el.dataset.avatarUrl;
    };
    img.onload = () => {
      el.classList.add('has-img');
    };

    if (img.getAttribute('src') !== url) {
      img.src = url;
    } else if (img.complete && img.naturalWidth > 0) {
      el.classList.add('has-img');
    }
  }

  function paintAllAvatars(p, { urlOverride = null } = {}) {
    paintAvatar($('pf-avatar-img'), p, { urlOverride });
    paintAvatar($('pf-preview-avatar'), p, { urlOverride });
    const sidebar = $('sidebar-user-avatar');
    if (sidebar) paintAvatar(sidebar, p, { urlOverride });
  }

  function broadcastAvatarUpdate(p) {
    window.dispatchEvent(new CustomEvent('user-avatar-updated', { detail: { profile: p } }));
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

  function resizeImage(file, max = 384) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Не удалось открыть изображение'));
        img.onload = () => {
          const cropSize = Math.min(img.width, img.height);
          const sx = Math.floor((img.width - cropSize) / 2);
          const sy = Math.floor((img.height - cropSize) / 2);
          const canvas = document.createElement('canvas');
          canvas.width = max;
          canvas.height = max;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, max, max);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
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
    const base = profile || window.getAuthState?.()?.profile || {};
    const full_name = $('pf-fullname')?.value?.trim() ?? base.full_name ?? '';
    const position = $('pf-position')?.value?.trim() ?? base.position ?? '';
    card?.classList.add('is-uploading');
    setStatus('pf-save-status', 'Сохраняем аватар…');
    try {
      const dataUrl = await resizeImage(file);
      const optimistic = { ...base, full_name, position, avatar_url: dataUrl };
      profile = optimistic;
      paintAllAvatars(optimistic, { urlOverride: dataUrl });
      broadcastAvatarUpdate(optimistic);

      const res = await window.api.authUploadAvatar?.({ dataUrl, full_name, position });
      if (!res?.ok) {
        profile = base;
        paintAllAvatars(base);
        broadcastAvatarUpdate(base);
        setStatus('pf-save-status', res?.message || 'Не удалось загрузить аватар', 'error');
        return;
      }
      const remoteUrl = res.avatarUrl || res.profile?.avatar_url || '';
      const verifiedUrl = remoteUrl ? await preloadAvatarUrl(remoteUrl) : null;
      const finalAvatarUrl = verifiedUrl || dataUrl;
      const next = res.profile
        ? { ...res.profile, avatar_url: finalAvatarUrl }
        : { ...optimistic, avatar_url: finalAvatarUrl };
      profile = next;
      paintAllAvatars(next, { urlOverride: finalAvatarUrl });
      syncPreview();
      broadcastAvatarUpdate(next);
      setStatus('pf-save-status', verifiedUrl ? 'Аватар сохранён' : 'Аватар сохранён локально — проверьте интернет', verifiedUrl ? 'ok' : 'error');
    } catch (err) {
      profile = base;
      paintAllAvatars(base);
      broadcastAvatarUpdate(base);
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

  window.Profile = { setProfile, open: openProfilePage, paintAllAvatars, preloadAvatarUrl };
})();
