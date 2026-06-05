(function () {
  const USER_ROLES = {
    designer: {
      id: 'designer',
      label: 'Дизайнер',
      description: 'PIK-FOLDER, Figma, шаблоны, канбан, Konstancia и мокапы',
      icon: '🎨',
    },
    frontend: {
      id: 'frontend',
      label: 'Front-end',
      description: 'Канбан, GitHub, Outline, почта и ИИ — без Figma',
      icon: '⚛️',
    },
    backend: {
      id: 'backend',
      label: 'Back-end',
      description: 'Канбан, GitHub, Outline, почта и ИИ — без Figma',
      icon: '🛠',
    },
    pm: {
      id: 'pm',
      label: 'Project Manager',
      description: 'Канбан, почта, агент и заметки',
      icon: '📋',
    },
    full: {
      id: 'full',
      label: 'Все разделы',
      description: 'Полный доступ ко всем инструментам',
      icon: '✦',
    },
  };

  const ROLE_PAGES = {
    designer: ['search', 'pikfolder', 'makeit', 'templates', 'nanobanana', 'magnific', 'bannermockup', 'metask', 'mail', 'agent', 'notes', 'setup', 'settings'],
    frontend: ['search', 'metask', 'mail', 'github', 'outline', 'notes', 'agent', 'settings'],
    backend: ['search', 'metask', 'mail', 'github', 'outline', 'notes', 'agent', 'settings'],
    pm: ['search', 'metask', 'mail', 'github', 'outline', 'agent', 'notes', 'settings'],
    full: ['search', 'pikfolder', 'makeit', 'templates', 'nanobanana', 'magnific', 'bannermockup', 'metask', 'agent', 'mail', 'github', 'outline', 'notes', 'setup', 'settings'],
  };

  const ROLE_DEFAULT_PAGE = {
    designer: 'agent',
    frontend: 'metask',
    backend: 'metask',
    pm: 'metask',
    full: 'agent',
  };

  const DEV_ROLES = new Set(['frontend', 'backend']);

  let currentRole = null;
  let pickerResolve = null;

  function normalizeRole(role) {
    const id = String(role || '').trim();
    return USER_ROLES[id] ? id : null;
  }

  function getAllowedPages(role = currentRole) {
    const id = normalizeRole(role) || 'designer';
    return ROLE_PAGES[id] || ROLE_PAGES.designer;
  }

  function getDefaultPage(role = currentRole) {
    const id = normalizeRole(role) || 'designer';
    return ROLE_DEFAULT_PAGE[id] || 'search';
  }

  function isPageAllowed(pageId, role = currentRole) {
    if (!pageId) return false;
    if (pageId === 'hotkey-detail') return false;
    return getAllowedPages(role).includes(pageId);
  }

  function getActivePageId() {
    const page = document.querySelector('.page.active');
    if (!page?.id) return null;
    return page.id.replace(/^page-/, '');
  }

  function navigateToPage(pageId) {
    if (!pageId || !isPageAllowed(pageId)) return false;
    const btn = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (btn) {
      btn.click();
      return true;
    }
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    if (pageId !== 'metask') window.detachMetaskBoard?.();
    if (pageId !== 'mail') window.detachMailView?.();
    const navBtn = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    navBtn?.classList.add('active');
    document.getElementById(`page-${pageId}`)?.classList.add('active');
    if (pageId === 'metask') window.activateMetaskPage?.();
    if (pageId === 'agent') window.activateAgentPage?.();
    if (pageId === 'nanobanana') window.activateNanobananaPage?.();
    if (pageId === 'magnific') window.activateMagnificPage?.();
    if (pageId === 'bannermockup') window.activateBannerMockupPage?.();
    if (pageId === 'mail') window.activateMailPage?.();
    if (pageId === 'github' || pageId === 'outline') window.activateWebtab?.(pageId);
    if (pageId === 'notes') window.activateNotesPage?.();
    if (pageId === 'search') window.activateSearchPage?.();
    if (pageId === 'pikfolder') window.activatePikFolderPage?.();
    return true;
  }

  function updateNavGroups() {
    document.querySelectorAll('.nav-group').forEach((group) => {
      const items = group.querySelectorAll('.nav-item[data-page]');
      const anyVisible = [...items].some((el) => !el.classList.contains('role-hidden'));
      group.classList.toggle('role-hidden', !anyVisible);
    });

    document.querySelectorAll('.nav-divider').forEach((divider) => {
      let prev = divider.previousElementSibling;
      while (prev && !prev.classList.contains('nav-group') && !prev.classList.contains('nav-divider')) {
        prev = prev.previousElementSibling;
      }
      let next = divider.nextElementSibling;
      while (next && !next.classList.contains('nav-group') && !next.classList.contains('nav-divider')) {
        next = next.nextElementSibling;
      }
      const hide = (prev?.classList.contains('role-hidden') || !prev)
        && (next?.classList.contains('role-hidden') || !next);
      divider.classList.toggle('role-hidden', hide);
    });

    const workLabel = document.getElementById('nav-work-label');
    if (workLabel) {
      workLabel.textContent = DEV_ROLES.has(currentRole) ? 'Разработка' : 'Работа';
    }

    const figmaLabel = document.getElementById('nav-figma-label');
    if (figmaLabel) {
      figmaLabel.textContent = DEV_ROLES.has(currentRole) ? 'Figma' : 'Figma';
    }
  }

  function applyRoleNav(role) {
    currentRole = normalizeRole(role) || currentRole || 'designer';
    const pages = getAllowedPages(currentRole);
    document.documentElement.dataset.userRole = currentRole;

    document.querySelectorAll('.nav-item[data-page]').forEach((btn) => {
      const allowed = pages.includes(btn.dataset.page);
      btn.classList.toggle('role-hidden', !allowed);
    });

    updateNavGroups();

    const active = getActivePageId();
    if (!active) {
      navigateToPage(getDefaultPage(currentRole));
    } else if (!isPageAllowed(active)) {
      navigateToPage(getDefaultPage(currentRole));
    }

    window.dispatchEvent(new CustomEvent('role-changed', { detail: { role: currentRole, pages } }));
    return currentRole;
  }

  function renderRoleGrid(selectedId, { animate = false } = {}) {
    const grid = document.getElementById('role-grid');
    if (!grid) return;
    const roles = Object.values(USER_ROLES);
    grid.innerHTML = roles.map((role, i) => {
      const active = role.id === selectedId ? ' is-selected' : '';
      const enter = animate ? ' role-card--enter' : '';
      return `
        <button type="button" class="role-card role-card--${role.id}${active}${enter}" data-role-id="${role.id}" style="--rp-i:${i}">
          <span class="role-card-glow" aria-hidden="true"></span>
          <span class="role-card-check" aria-hidden="true">✓</span>
          <span class="role-card-icon" aria-hidden="true">${role.icon}</span>
          <span class="role-card-body">
            <span class="role-card-label">${role.label}</span>
            <span class="role-card-desc">${role.description}</span>
          </span>
        </button>`;
    }).join('');
  }

  function selectRoleCard(selectedId) {
    document.querySelectorAll('.role-card[data-role-id]').forEach((card) => {
      card.classList.toggle('is-selected', card.dataset.roleId === selectedId);
    });
  }

  function closeRolePicker(overlay) {
    overlay.classList.remove('is-visible');
    overlay.classList.add('is-closing');
    return new Promise((resolve) => {
      window.setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('is-closing');
        resolve();
      }, 340);
    });
  }

  function openRolePicker(overlay) {
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
    });
  }

  function showRolePicker({ required = true } = {}) {
    const overlay = document.getElementById('role-picker');
    if (!overlay) return Promise.resolve(null);

    let selected = currentRole;
    renderRoleGrid(selected, { animate: true });
    openRolePicker(overlay);

    const confirmBtn = document.getElementById('role-picker-confirm');
    if (confirmBtn) {
      confirmBtn.disabled = !selected;
      confirmBtn.classList.toggle('is-ready', !!selected);
    }

    return new Promise((resolve) => {
      pickerResolve = resolve;

      const onGridClick = (e) => {
        const card = e.target.closest('[data-role-id]');
        if (!card) return;
        selected = card.dataset.roleId;
        selectRoleCard(selected);
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.classList.remove('is-ready');
          void confirmBtn.offsetWidth;
          confirmBtn.classList.add('is-ready');
        }
      };

      const onConfirm = async () => {
        if (!selected) return;
        await closeRolePicker(overlay);
        grid?.removeEventListener('click', onGridClick);
        confirmBtn?.removeEventListener('click', onConfirm);
        resolve(selected);
        pickerResolve = null;
      };

      const grid = document.getElementById('role-grid');
      grid?.addEventListener('click', onGridClick);
      confirmBtn?.addEventListener('click', onConfirm);

      if (!required) {
        document.getElementById('role-picker-skip')?.addEventListener('click', async () => {
          await closeRolePicker(overlay);
          resolve(selected || 'designer');
          pickerResolve = null;
        }, { once: true });
      }
    });
  }

  async function saveRole(role) {
    const normalized = normalizeRole(role);
    if (!normalized) return null;
    const config = await window.api.updateAppSettings({
      user: { role: normalized, roleSelectedAt: new Date().toISOString() },
    });
    applyRoleNav(normalized);
    return config;
  }

  async function initRoleNav(config, options = {}) {
    const role = normalizeRole(config?.settings?.user?.role);
    if (role) {
      applyRoleNav(role);
      return role;
    }
    if (options.requirePicker === false) {
      applyRoleNav('designer');
      return 'designer';
    }
    const picked = await showRolePicker({ required: true });
    if (picked) {
      await saveRole(picked);
      return picked;
    }
    applyRoleNav('designer');
    return 'designer';
  }

  function populateRoleSelect(selectEl, value) {
    if (!selectEl) return;
    selectEl.innerHTML = Object.values(USER_ROLES).map((role) =>
      `<option value="${role.id}">${role.label}</option>`,
    ).join('');
    selectEl.value = normalizeRole(value) || 'designer';
  }

  window.RoleNav = {
    USER_ROLES,
    getRole: () => currentRole,
    getAllowedPages,
    isPageAllowed,
    applyRoleNav,
    navigateToPage,
    initRoleNav,
    saveRole,
    populateRoleSelect,
    showRolePicker,
  };

  window.initRoleNav = initRoleNav;
})();
