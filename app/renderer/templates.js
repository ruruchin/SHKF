(function () {
  let templates = [];
  let categories = [];
  let activeCategory = 'all';
  let activeLibrary = 'all';
  let thumbCache = {};
  let thumbObserver = null;
  let scrollRoot = null;
  let scrollEndTimer = null;
  let gridClickBound = false;
  let animateNextGrid = false;

  const PREVIEWS = {
    'btn-primary': `<div class="tpl-canvas"><span class="tpl-m tpl-btn-primary">Get started</span></div>`,
    'btn-secondary': `<div class="tpl-canvas"><span class="tpl-m tpl-btn-secondary">Learn more</span></div>`,
    'btn-ghost': `<div class="tpl-canvas"><span class="tpl-m tpl-btn-ghost">View all</span></div>`,
    'btn-danger': `<div class="tpl-canvas"><span class="tpl-m tpl-btn-danger">Delete</span></div>`,
    'btn-icon': `<div class="tpl-canvas"><span class="tpl-m tpl-btn-icon">+</span></div>`,
    'btn-segment': `<div class="tpl-canvas tpl-canvas-wide"><div class="tpl-m tpl-segment"><span class="on">Day</span><span>Week</span></div></div>`,
    'input-field': `<div class="tpl-canvas tpl-canvas-narrow"><div class="tpl-m tpl-field"><span class="tpl-field-label">Email</span><span class="tpl-field-input">you@company.com</span></div></div>`,
    textarea: `<div class="tpl-canvas tpl-canvas-narrow"><div class="tpl-m tpl-field"><span class="tpl-field-label">Description</span><span class="tpl-field-input tpl-field-textarea">Enter details…</span></div></div>`,
    'search-bar': `<div class="tpl-canvas"><div class="tpl-m tpl-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg><span>Search…</span></div></div>`,
    'select-field': `<div class="tpl-canvas tpl-canvas-narrow"><div class="tpl-m tpl-field"><span class="tpl-field-label">Country</span><span class="tpl-field-input tpl-field-select">United States ▾</span></div></div>`,
    checkbox: `<div class="tpl-canvas tpl-canvas-narrow"><div class="tpl-m tpl-checkbox"><span class="tpl-checkbox-box on">✓</span><span>Remember me</span></div></div>`,
    'radio-group': `<div class="tpl-canvas tpl-canvas-narrow"><div class="tpl-m tpl-radio"><div><span class="on"></span>Standard</div><div><span></span>Express</div></div></div>`,
    'file-upload': `<div class="tpl-canvas"><div class="tpl-m tpl-upload"><span>+</span><small>Drop file or click</small></div></div>`,
    card: `<div class="tpl-canvas"><div class="tpl-m tpl-card-ui"><strong>Card title</strong><p>Supporting text goes here.</p></div></div>`,
    'stat-widget': `<div class="tpl-canvas"><div class="tpl-m tpl-stat"><span class="tpl-stat-val">2,847</span><span class="tpl-stat-lbl">Active users</span></div></div>`,
    'product-card': `<div class="tpl-canvas"><div class="tpl-m tpl-product"><span class="tpl-product-img"></span><strong>Wireless Headphones</strong><span class="tpl-product-price">$249</span></div></div>`,
    'pricing-card': `<div class="tpl-canvas"><div class="tpl-m tpl-pricing"><strong>Pro</strong><span class="tpl-pricing-price">$29<small>/mo</small></span><span class="tpl-pricing-feat">✓ Unlimited</span></div></div>`,
    'profile-card': `<div class="tpl-canvas"><div class="tpl-m tpl-profile"><span class="tpl-profile-av"></span><div><strong>Alex Morgan</strong><span>Product Designer</span></div></div></div>`,
    navbar: `<div class="tpl-canvas tpl-canvas-wide"><div class="tpl-m tpl-nav"><strong>Logo</strong><span>Home</span><span>Products</span><span>Pricing</span></div></div>`,
    sidebar: `<div class="tpl-canvas"><div class="tpl-m tpl-sidebar"><span class="on">Dashboard</span><span>Projects</span><span>Team</span></div></div>`,
    tabs: `<div class="tpl-canvas tpl-canvas-wide"><div class="tpl-m tpl-tabs"><span class="on">Overview</span><span>Analytics</span><span>Reports</span></div></div>`,
    breadcrumb: `<div class="tpl-canvas tpl-canvas-wide"><div class="tpl-m tpl-breadcrumb"><span>Home</span><i>/</i><span>Projects</span><i>/</i><strong>Dashboard</strong></div></div>`,
    pagination: `<div class="tpl-canvas"><div class="tpl-m tpl-pagination"><span>‹</span><span class="on">1</span><span>2</span><span>3</span><span>›</span></div></div>`,
    'list-item': `<div class="tpl-canvas"><div class="tpl-m tpl-list"><span class="tpl-list-av"></span><div><strong>Alex Morgan</strong><span>Product Designer</span></div></div></div>`,
    badge: `<div class="tpl-canvas"><span class="tpl-m tpl-badge">New</span></div>`,
    modal: `<div class="tpl-canvas"><div class="tpl-m tpl-modal-ui"><strong>Delete item?</strong><p>This action cannot be undone.</p><div class="tpl-modal-actions"><span class="tpl-btn-secondary-sm">Cancel</span><span class="tpl-btn-danger-sm">Delete</span></div></div></div>`,
    'toggle-row': `<div class="tpl-canvas"><div class="tpl-m tpl-toggle-row"><span>Notifications</span><span class="tpl-toggle on"><i></i></span></div></div>`,
    'avatar-group': `<div class="tpl-canvas"><div class="tpl-m tpl-avatars"><span></span><span></span><span></span><span></span></div></div>`,
    'progress-bar': `<div class="tpl-canvas tpl-canvas-narrow"><div class="tpl-m tpl-progress"><div class="tpl-progress-head"><span>Uploading…</span><strong>68%</strong></div><span class="tpl-progress-track"><i style="width:68%"></i></span></div></div>`,
    divider: `<div class="tpl-canvas tpl-canvas-wide"><div class="tpl-m tpl-divider"><span></span><em>OR</em><span></span></div></div>`,
    'alert-success': `<div class="tpl-canvas tpl-canvas-wide"><div class="tpl-m tpl-alert">✓ Changes saved successfully</div></div>`,
    'toast-notif': `<div class="tpl-canvas tpl-canvas-wide"><div class="tpl-m tpl-toast-ui"><strong>New message</strong><span>3 unread notifications</span></div></div>`,
    'empty-state': `<div class="tpl-canvas"><div class="tpl-m tpl-empty"><span class="tpl-empty-icon"></span><strong>No items yet</strong><span>Create your first project</span></div></div>`,
    'table-row': `<div class="tpl-canvas tpl-canvas-wide"><div class="tpl-m tpl-table-row"><strong>Website redesign</strong><span>In progress</span><span>Mar 12</span><em>Design</em></div></div>`,
    'chart-bar': `<div class="tpl-canvas"><div class="tpl-m tpl-chart"><span class="tpl-chart-bar" style="height:28%"></span><span class="tpl-chart-bar" style="height:56%"></span><span class="tpl-chart-bar" style="height:80%"></span><span class="tpl-chart-bar" style="height:68%"></span><span class="tpl-chart-bar on" style="height:92%"></span></div></div>`,
  };

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function previewHtml(t) {
    if (t.user) {
      const src = thumbCache[t.id];
      if (src) {
        return `<div class="tpl-preview tpl-preview-user"><img src="${src}" alt="" class="tpl-thumb-img" draggable="false" loading="lazy" decoding="async" /></div>`;
      }
      return `<div class="tpl-preview tpl-preview-user tpl-preview-loading"><span class="tpl-thumb-placeholder">⬡</span></div>`;
    }
    return `<div class="tpl-preview">${PREVIEWS[t.preview] || PREVIEWS['btn-primary']}</div>`;
  }

  function userCardDesc(t) {
    const parts = [];
    if (t.category) parts.push(t.category);
    if (t.figma?.fileName && t.figma.fileName !== 'Untitled') parts.push(t.figma.fileName);
    return parts.join(' · ') || 'Импорт из Figma';
  }

  function userTemplateCount() {
    return templates.filter((t) => t.user).length;
  }

  function mineHeroSubtitle() {
    const count = userTemplateCount();
    if (!count) return 'Импортируйте из Figma';
    return `${count} ${pluralComponents(count)}`;
  }

  function mineHeroStackHtml() {
    const userTemplates = templates.filter((t) => t.user).slice(0, 3);
    const rotations = ['-14deg', '9deg', '-5deg'];
    const slots = 3;
    let html = '';
    for (let i = 0; i < slots; i += 1) {
      const t = userTemplates[i];
      const src = t ? thumbCache[t.id] : null;
      const inner = src ? `<img src="${src}" alt="" draggable="false" />` : '';
      html += `
        <span class="tpl-mine-hero-photo${src ? '' : ' is-placeholder'}" data-slot="${i}" style="--r:${rotations[i]}">
          ${inner}
        </span>`;
    }
    return html;
  }

  function renderMineHeroCard() {
    return `
      <article class="tpl-mine-hero">
        <button type="button" class="tpl-mine-hero-btn" aria-label="Открыть мои компоненты">
          <div class="tpl-mine-hero-copy">
            <span class="tpl-mine-hero-label">Моя библиотека</span>
            <span class="tpl-mine-hero-title">Мои компоненты</span>
            <span class="tpl-mine-hero-sub">${escapeHtml(mineHeroSubtitle())}</span>
          </div>
          <div class="tpl-mine-hero-stack" aria-hidden="true">
            ${mineHeroStackHtml()}
          </div>
        </button>
      </article>`;
  }

  function patchMineHeroStack() {
    const hero = document.querySelector('.tpl-mine-hero');
    if (!hero) return;
    const userTemplates = templates.filter((t) => t.user).slice(0, 3);
    hero.querySelectorAll('.tpl-mine-hero-photo').forEach((photo, index) => {
      const t = userTemplates[index];
      const src = t ? thumbCache[t.id] : null;
      if (!src) return;
      photo.classList.remove('is-placeholder');
      photo.innerHTML = `<img src="${src}" alt="" draggable="false" />`;
    });
    const sub = hero.querySelector('.tpl-mine-hero-sub');
    if (sub) sub.textContent = mineHeroSubtitle();
  }

  function navigateToMineLibrary() {
    activeLibrary = 'mine';
    activeCategory = 'all';
    document.querySelectorAll('.tpl-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.lib === 'mine');
    });
    updateLibraryTabs();
    renderChips();
    animateNextGrid = true;
    renderGrid();
  }

  function filteredTemplates() {
    let list = templates;
    if (activeLibrary === 'mine') {
      list = list.filter((t) => t.user);
    } else {
      list = list.filter((t) => !t.user);
    }
    if (activeCategory !== 'all') list = list.filter((t) => t.category === activeCategory);
    return list;
  }

  async function loadThumbs(items) {
    const pending = items.filter((i) => i.user && !thumbCache[i.id]);
    if (!pending.length) return;
    await Promise.all(
      pending.map(async (t) => {
        try {
          const data = await window.api.getUserTemplateThumb(t.id);
          if (data) {
            thumbCache[t.id] = data;
            patchCardThumb(t.id, data);
          }
        } catch { /* ignore */ }
      })
    );
  }

  function patchCardThumb(id, src) {
    const grid = document.getElementById('templates-grid');
    const card = grid?.querySelector(`[data-template-id="${CSS.escape(id)}"]`);
    const wrap = card?.querySelector('.tpl-preview-wrap');
    if (!wrap || !src) return;
    wrap.innerHTML = `
      <div class="tpl-preview tpl-preview-user">
        <img src="${src}" alt="" class="tpl-thumb-img" draggable="false" loading="lazy" decoding="async" />
      </div>
      <span class="tpl-insert-overlay">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Вставить
      </span>`;
    card?.querySelector('.tpl-thumb-img')?.removeAttribute('data-needs-thumb');
  }

  function observeUserThumbs() {
    const grid = document.getElementById('templates-grid');
    if (!grid || !scrollRoot) return;

    thumbObserver?.disconnect();
    thumbObserver = new IntersectionObserver(
      (entries) => {
        const ids = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.dataset.templateId;
          if (id) ids.push(id);
          thumbObserver.unobserve(entry.target);
        }
        if (ids.length) {
          loadThumbs(templates.filter((t) => ids.includes(t.id))).then(() => patchMineHeroStack());
        }
      },
      { root: scrollRoot, rootMargin: '240px 0px', threshold: 0.01 }
    );

    grid.querySelectorAll('.tpl-card-user[data-template-id]').forEach((card) => {
      if (!thumbCache[card.dataset.templateId]) {
        thumbObserver.observe(card);
      }
    });
  }

  function bindScrollPerf() {
    scrollRoot = document.querySelector('.templates-scroll');
    if (!scrollRoot || scrollRoot.dataset.perfBound) return;
    scrollRoot.dataset.perfBound = '1';

    scrollRoot.addEventListener(
      'scroll',
      () => {
        scrollRoot.classList.add('is-scrolling');
        clearTimeout(scrollEndTimer);
        scrollEndTimer = setTimeout(() => {
          scrollRoot.classList.remove('is-scrolling');
        }, 120);
      },
      { passive: true }
    );
  }

  function bindGridEvents() {
    const grid = document.getElementById('templates-grid');
    if (!grid || gridClickBound) return;
    gridClickBound = true;

    grid.addEventListener('click', (e) => {
      const heroBtn = e.target.closest('.tpl-mine-hero-btn');
      if (heroBtn) {
        e.preventDefault();
        navigateToMineLibrary();
        return;
      }
      const deleteBtn = e.target.closest('.tpl-card-delete');
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        deleteUserTemplate(deleteBtn.dataset.deleteId);
        return;
      }
      const main = e.target.closest('.tpl-card-main');
      if (main) {
        const card = main.closest('.tpl-card');
        copyTemplate(card?.dataset.templateId, card);
      }
    });
  }

  async function renderGrid() {
    const grid = document.getElementById('templates-grid');
    const empty = document.getElementById('templates-empty');
    const countEl = document.getElementById('templates-count');
    if (!grid) return;

    const filtered = filteredTemplates();
    const showMineHero = activeLibrary === 'all' && activeCategory === 'all';

    if (countEl) {
      countEl.textContent = `${filtered.length} ${pluralComponents(filtered.length)}`;
    }

    updateEmptyState(filtered);

    if (!filtered.length && !showMineHero) {
      grid.innerHTML = '';
      grid.classList.remove('tpl-animate-in');
      empty?.classList.remove('hidden');
      thumbObserver?.disconnect();
      return;
    }
    empty?.classList.add('hidden');

    const cardsHtml = filtered.map((t, i) => {
      const cardIndex = i + (showMineHero ? 1 : 0);
      const userClass = t.user ? ' tpl-card-user' : '';
      const badge = t.user
        ? '<span class="tpl-card-badge">Мой</span>'
        : '<span class="tpl-card-cat">' + escapeHtml(t.category) + '</span>';
      const desc = t.user ? userCardDesc(t) : escapeHtml(t.description || '');
      const deleteBlock = t.user
        ? `<div class="tpl-card-actions">
            <button type="button" class="tpl-card-delete" data-delete-id="${escapeHtml(t.id)}" title="Удалить из библиотеки">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              Удалить
            </button>
          </div>`
        : '';

      return `
      <article class="tpl-card${userClass}" data-template-id="${escapeHtml(t.id)}" style="--i:${cardIndex}">
        <button type="button" class="tpl-card-main" title="${t.user ? 'Вставить компонент' : 'Скопировать в буфер'}">
          <div class="tpl-preview-wrap">
            ${previewHtml(t)}
            <span class="tpl-insert-overlay">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              ${t.user ? 'Вставить' : 'Копировать'}
            </span>
          </div>
          <div class="tpl-card-body">
            <div class="tpl-card-top">
              <h3 class="tpl-card-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</h3>
              ${badge}
            </div>
            <p class="tpl-card-desc">${desc}</p>
          </div>
        </button>
        ${deleteBlock}
      </article>`;
    }).join('');

    grid.innerHTML = (showMineHero ? renderMineHeroCard() : '') + cardsHtml;

    if (showMineHero) {
      loadThumbs(templates.filter((t) => t.user).slice(0, 3)).then(() => patchMineHeroStack());
    }

    if (animateNextGrid) {
      grid.classList.add('tpl-animate-in');
      animateNextGrid = false;
      window.setTimeout(() => grid.classList.remove('tpl-animate-in'), 400);
    } else {
      grid.classList.remove('tpl-animate-in');
    }

    observeUserThumbs();
  }

  function updateEmptyState(filtered) {
    const title = document.getElementById('templates-empty-title');
    const desc = document.getElementById('templates-empty-desc');
    if (!title || !desc) return;

    if (activeLibrary === 'mine') {
      title.textContent = 'Библиотека пуста';
      desc.textContent = 'Выделите компонент в Figma и сохраните через SHKF Bridge → «Сохранить выделение в SHKF»';
    } else if (activeCategory !== 'all') {
      title.textContent = 'Нет компонентов в категории';
      desc.textContent = 'Выберите другую категорию или импортируйте свои компоненты из Figma';
    } else {
      title.textContent = 'Нет компонентов';
      desc.textContent = 'Импортируйте компоненты из Figma или выберите другой фильтр';
    }
  }

  function pluralComponents(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'компонент';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'компонента';
    return 'компонентов';
  }

  function renderChips() {
    const chips = document.getElementById('templates-chips');
    if (!chips) return;

    let cats = categories;
    if (activeLibrary === 'mine') {
      const userCats = [...new Set(templates.filter((t) => t.user).map((t) => t.category))];
      cats = userCats.length ? userCats : ['Мои компоненты'];
    } else if (activeLibrary === 'builtin' || activeLibrary === 'all') {
      cats = categories.filter((c) => templates.some((t) => !t.user && t.category === c));
    }

    const items = [{ id: 'all', label: 'Все категории' }, ...cats.map((c) => ({ id: c, label: c }))];
    if (activeCategory !== 'all' && !items.some((i) => i.id === activeCategory)) {
      activeCategory = 'all';
    }

    chips.innerHTML = items.map((item) =>
      `<button type="button" class="chip${activeCategory === item.id ? ' active' : ''}" data-cat="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`
    ).join('');

    chips.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeCategory = chip.dataset.cat;
        chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.cat === activeCategory));
        renderGrid();
      });
    });
  }

  function isImportBannerEnabled() {
    return window.appSettings?.templates?.showImportBanner !== false;
  }

  function updateImportBannerVisibility() {
    const banner = document.getElementById('tpl-import-banner');
    const reopen = document.getElementById('tpl-import-reopen');
    const onMine = activeLibrary === 'mine';
    const showBanner = onMine && isImportBannerEnabled();

    banner?.classList.toggle('hidden', !showBanner);
    reopen?.classList.toggle('hidden', !onMine || showBanner);
  }

  function updateLibraryTabs(data) {
    const userCount = document.getElementById('tpl-user-count');
    const builtinCount = document.getElementById('tpl-builtin-count');
    if (userCount) userCount.textContent = String(data?.userCount ?? templates.filter((t) => t.user).length);
    if (builtinCount) builtinCount.textContent = String(data?.builtInCount ?? templates.filter((t) => !t.user).length);
    updateImportBannerVisibility();
  }

  function updatePluginStatus(status) {
    const dot = document.getElementById('tpl-plugin-dot');
    const text = document.getElementById('tpl-plugin-status-text');
    if (!dot || !text) return;
    const on = status?.pluginConnected;
    dot.classList.toggle('on', !!on);
    text.textContent = on
      ? 'Плагин подключён — можно импортировать'
      : 'Плагин не подключён — откройте SHKF Bridge в Figma';
  }

  function bindLibraryTabs() {
    document.querySelectorAll('.tpl-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        activeLibrary = tab.dataset.lib;
        activeCategory = 'all';
        document.querySelectorAll('.tpl-tab').forEach((t) => {
          t.classList.toggle('active', t.dataset.lib === activeLibrary);
        });
        updateLibraryTabs();
        renderChips();
        renderGrid();
      });
    });

    document.getElementById('tpl-open-setup')?.addEventListener('click', () => {
      document.querySelector('.nav-item[data-page="setup"]')?.click();
    });

    document.getElementById('tpl-import-close')?.addEventListener('click', async () => {
      if (window.appSettings?.templates) {
        window.appSettings.templates.showImportBanner = false;
      }
      updateImportBannerVisibility();
      try {
        await window.api.updateAppSettings({ templates: { showImportBanner: false } });
      } catch { /* local state already updated */ }
    });

    document.getElementById('tpl-import-reopen')?.addEventListener('click', async () => {
      if (window.appSettings?.templates) {
        window.appSettings.templates.showImportBanner = true;
      }
      updateImportBannerVisibility();
      try {
        await window.api.updateAppSettings({ templates: { showImportBanner: true } });
      } catch { /* ignore */ }
    });
  }

  async function copyTemplate(id, cardEl) {
    cardEl?.classList.add('tpl-inserting');
    try {
      const result = await window.api.copyTemplate(id);
      if (result?.ok) {
        const msg = result.mode === 'plugin'
          ? '«' + (result.name || id) + '» вставлен в Figma'
          : '«' + (result.name || id) + '» скопирован — Ctrl+V в Figma';
        showToast(msg, 'success');
        cardEl?.classList.add('tpl-success');
        setTimeout(() => cardEl?.classList.remove('tpl-success'), 600);
      } else {
        showToast(result?.message || 'Не удалось вставить', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Ошибка', 'error');
    } finally {
      cardEl?.classList.remove('tpl-inserting');
    }
  }

  async function deleteUserTemplate(id) {
    if (!confirm('Удалить компонент из библиотеки?')) return;
    try {
      await window.api.deleteUserTemplate(id);
      delete thumbCache[id];
      await reloadTemplates();
      showToast('Компонент удалён', 'success');
    } catch (err) {
      showToast(err.message || 'Не удалось удалить', 'error');
    }
  }

  function showToast(msg, type) {
    if (window.appSettings?.templates?.showCopyToast === false) return;
    let toast = document.getElementById('tpl-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tpl-toast';
      toast.className = 'tpl-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'tpl-toast tpl-toast-' + (type || 'info') + ' tpl-toast-show';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('tpl-toast-show'), 2800);
  }

  function rebuildSearchEntries() {
    window.templateSearchEntries = templates.map((t) => ({
      id: 'tpl-' + t.id,
      type: 'template',
      title: t.name,
      subtitle: t.user ? ('Моя библиотека · ' + (t.description || '')) : t.description,
      keywords: [t.category, t.description, t.name, t.user ? 'мой импорт figma ds' : ''].join(' '),
      category: t.category,
      page: 'templates',
      templateId: t.id,
      user: t.user,
    }));
    window.rebuildSearchIndex?.();
  }

  async function reloadTemplates() {
    try {
      const data = await window.api.getTemplates();
      templates = data.templates || [];
      categories = data.categories || [];
      updateLibraryTabs(data);
      renderChips();
      await renderGrid();
      rebuildSearchEntries();
    } catch {
      templates = [];
      categories = [];
    }
  }

  async function initTemplates() {
    bindScrollPerf();
    bindGridEvents();
    bindLibraryTabs();
    animateNextGrid = true;
    await reloadTemplates();

    window.api.onLibraryUpdated?.(() => {
      reloadTemplates().then(() => {
        if (activeLibrary !== 'mine') {
          activeLibrary = 'mine';
          document.querySelectorAll('.tpl-tab').forEach((t) => {
            t.classList.toggle('active', t.dataset.lib === 'mine');
          });
          updateLibraryTabs();
          renderChips();
        }
        showToast('Новый компонент добавлен в библиотеку', 'success');
      });
    });

    window.api.onStatus?.((s) => updatePluginStatus(s));
    window.api.getStatus?.().then(updatePluginStatus).catch(() => {});
  }

  window.initTemplates = initTemplates;
  window.reloadTemplates = reloadTemplates;
})();
