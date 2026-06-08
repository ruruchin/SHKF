(function initSidebarRail() {
  const STORAGE_KEY = 'shkf.sidebarExpanded';
  const sidebar = document.getElementById('app-sidebar');
  const toggleBtn = document.getElementById('sidebar-rail-toggle');
  const helpBtn = document.getElementById('sidebar-rail-help');
  if (!sidebar) return;

  const NAV_LABELS = {
    search: 'Поиск',
    pikfolder: 'PIK-FOLDER',
    templates: 'Templates',
    nanobanana: 'NanoBanana',
    magnific: 'Magnific MCP',
    bannermockup: 'Мокап',
    metask: 'Канбан',
    agent: 'Konstancia',
    teamchat: 'Команда',
    mail: 'Почта',
    github: 'GitHub',
    outline: 'Outline',
    setup: 'Figma',
    settings: 'Настройки',
  };

  function normalizeNavItems() {
    document.querySelectorAll('.nav-item[data-page]').forEach((btn) => {
      const page = btn.dataset.page;
      if (!btn.querySelector('.nav-item-icon')) {
        const iconWrap = document.createElement('span');
        iconWrap.className = 'nav-item-icon';
        const movable = [];
        for (const child of [...btn.childNodes]) {
          if (child.nodeType === Node.ELEMENT_NODE) movable.push(child);
        }
        movable.forEach((node) => iconWrap.appendChild(node));
        btn.textContent = '';
        btn.appendChild(iconWrap);
        const label = document.createElement('span');
        label.className = 'nav-item-label';
        label.textContent = NAV_LABELS[page] || btn.textContent.trim();
        btn.appendChild(label);
      } else if (!btn.querySelector('.nav-item-label')) {
        const label = document.createElement('span');
        label.className = 'nav-item-label';
        label.textContent = NAV_LABELS[page] || '';
        btn.appendChild(label);
      }
      if (!btn.dataset.tooltip) {
        btn.dataset.tooltip = btn.querySelector('.nav-item-label')?.textContent?.trim() || NAV_LABELS[page] || '';
      }
    });
  }

  function syncUserTooltip() {
    const card = document.getElementById('sidebar-user-card');
    const name = document.getElementById('sidebar-user-name')?.textContent?.trim();
    if (card && name) card.dataset.tooltip = name;
  }

  function setExpanded(expanded, { persist = true } = {}) {
    sidebar.classList.toggle('is-expanded', expanded);
    if (toggleBtn) {
      toggleBtn.title = expanded ? 'Свернуть меню' : 'Развернуть меню';
      toggleBtn.setAttribute('aria-label', toggleBtn.title);
    }
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  }

  function readExpandedPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  function updateTeamChatBadge(unread = 0) {
    const badge = document.getElementById('nav-teamchat-badge');
    const nav = document.querySelector('.nav-item[data-page="teamchat"]');
    const count = Math.max(0, Number(unread) || 0);
    nav?.classList.toggle('has-teamchat-unread', count > 0);
    if (!badge) return;
    badge.classList.toggle('hidden', count <= 0);
    badge.classList.toggle('has-count', count > 1);
    badge.textContent = count > 1 ? (count > 9 ? '9+' : String(count)) : '';
    badge.setAttribute('aria-label', count > 0 ? `Непрочитанных: ${count}` : '');
  }

  const KONSTANCIA_AVATAR_SRC = 'assets/agent/agent-avatar.png';

  function ensureKonstanciaNavIcon(live2dSrc) {
    const img = document.querySelector('.nav-item[data-page="agent"] [data-sidebar-static="1"]');
    if (!img) return;
    const live2d = live2dSrc || window.AgentLive2d?.getBrandAvatarSrc?.() || '';
    const next = live2d || KONSTANCIA_AVATAR_SRC;
    img.src = next;
    const slot = img.closest('.agent-brand-avatar');
    if (next.startsWith('data:image/')) {
      img.dataset.live2d = '1';
      slot?.classList.add('agent-brand-avatar--live2d');
    } else {
      img.removeAttribute('data-live2d');
      slot?.classList.remove('agent-brand-avatar--live2d');
    }
  }

  normalizeNavItems();
  ensureKonstanciaNavIcon();
  setExpanded(readExpandedPreference(), { persist: false });
  syncUserTooltip();

  toggleBtn?.addEventListener('click', () => {
    setExpanded(!sidebar.classList.contains('is-expanded'));
  });

  helpBtn?.addEventListener('click', () => {
    document.querySelector('.nav-item[data-page="search"]')?.click();
    window.activateSearchPage?.();
  });

  window.addEventListener('auth-session-changed', syncUserTooltip);
  window.addEventListener('user-avatar-updated', syncUserTooltip);

  const nameEl = document.getElementById('sidebar-user-name');
  if (nameEl) {
    new MutationObserver(syncUserTooltip).observe(nameEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  window.addEventListener('agent-brand-avatar-updated', (event) => {
    ensureKonstanciaNavIcon(event?.detail?.src);
  });

  window.SidebarRail = {
    setExpanded,
    isExpanded: () => sidebar.classList.contains('is-expanded'),
    updateTeamChatBadge,
    ensureKonstanciaNavIcon,
  };
})();
