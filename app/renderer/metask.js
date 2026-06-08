(function () {
  let syncing = false;
  let boardAttached = false;
  let authPinnedOpen = false;
  let savedMetaskSettings = {};
  let resizeObserver = null;
  let listPanelCollapsed = false;

  const LIST_COLLAPSED_KEY = 'metask-list-collapsed';
  const LIST_LAYOUT_VERSION = '3';
  const LIST_PANEL_MS = 300;
  let boardLayoutAnimFrame = null;

  function runBoardLayoutDuringTransition() {
    const start = performance.now();
    if (boardLayoutAnimFrame) cancelAnimationFrame(boardLayoutAnimFrame);
    attachBoard();
    const step = () => {
      attachBoard();
      if (performance.now() - start < LIST_PANEL_MS + 48) {
        boardLayoutAnimFrame = requestAnimationFrame(step);
      } else {
        boardLayoutAnimFrame = null;
        attachBoard();
        setTimeout(attachBoard, 60);
      }
    };
    boardLayoutAnimFrame = requestAnimationFrame(step);
  }

  function syncListPanelChrome() {
    const split = $('metask-split');
    const collapsed = split?.classList.contains('metask-split--list-collapsed') ?? listPanelCollapsed;
    listPanelCollapsed = collapsed;

    const collapseBtn = $('metask-list-collapse');
    collapseBtn?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  function setListPanelCollapsed(collapsed, { animate = true } = {}) {
    listPanelCollapsed = !!collapsed;
    const split = $('metask-split');
    if (!animate) split?.classList.add('metask-split--no-transition');
    split?.classList.toggle('metask-split--list-collapsed', listPanelCollapsed);
    syncListPanelChrome();
    try {
      localStorage.setItem(LIST_COLLAPSED_KEY, listPanelCollapsed ? '1' : '0');
    } catch { /* ignore */ }
    scheduleBoardLayout();
    if (animate) runBoardLayoutDuringTransition();
    else {
      attachBoard();
      requestAnimationFrame(() => {
        attachBoard();
        split?.classList.remove('metask-split--no-transition');
      });
    }
    requestAnimationFrame(() => {
      window.api.metaskResizeBoard?.();
    });
  }

  async function expandListPanel() {
    if (!listPanelCollapsed) return;
    boardAttached = false;
    if (window.api.metaskDetachBoard) await window.api.metaskDetachBoard();
    setListPanelCollapsed(false);
  }

  function restoreListPanelCollapsed() {
    try {
      if (localStorage.getItem('metask-list-layout-v') !== LIST_LAYOUT_VERSION) {
        localStorage.setItem(LIST_COLLAPSED_KEY, '0');
        localStorage.setItem('metask-list-layout-v', LIST_LAYOUT_VERSION);
      }
      const collapsed = localStorage.getItem(LIST_COLLAPSED_KEY) === '1';
      setListPanelCollapsed(collapsed, { animate: false });
    } catch {
      setListPanelCollapsed(false, { animate: false });
    }
  }

  function updateListPanelChrome(taskCount) {
    const count = Number(taskCount) || 0;
    const collapseBtn = $('metask-list-collapse');
    const expandSeam = $('metask-list-expand-seam');
    const seamCount = $('metask-list-seam-count');
    if (collapseBtn) {
      collapseBtn.title = count
        ? `Свернуть список (${count})`
        : 'Свернуть список задач';
    }
    if (expandSeam) {
      expandSeam.title = count
        ? `Показать список (${count})`
        : 'Показать список задач';
    }
    if (seamCount) {
      if (count > 0) {
        seamCount.textContent = String(count);
        seamCount.removeAttribute('hidden');
      } else {
        seamCount.textContent = '';
        seamCount.setAttribute('hidden', '');
      }
    }
    syncListPanelChrome();
  }

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  const MP_TAG_PALETTE = ['mp-tag-coral', 'mp-tag-sky', 'mp-tag-mint', 'mp-tag-lavender', 'mp-tag-rose'];
  const PROJECT_HUES = [22, 199, 152, 262, 340, 48, 210, 280];

  function getProjectTagClass(project) {
    if (!project) return '';
    let h = 0;
    for (let i = 0; i < project.length; i += 1) {
      h = (h * 31 + project.charCodeAt(i)) >>> 0;
    }
    return MP_TAG_PALETTE[h % MP_TAG_PALETTE.length];
  }

  function getStatusTagClass(status) {
    const s = (status || '').toLowerCase();
    if (/закры|решен|closed|done|resolved|выполн/.test(s)) return 'mp-tag-slate';
    if (/одобр|approved|готов/.test(s)) return 'mp-tag-mint';
    if (/проверк|qa|review|тест|качеств/.test(s)) return 'mp-tag-lavender';
    if (/в работе|progress|разработ|develop|implement/.test(s)) return 'mp-tag-sky';
    if (/нов|new|открыт|open/.test(s)) return 'mp-tag-teal';
    if (/отклон|reject|block|отмен/.test(s)) return 'mp-tag-coral';
    if (/ожид|wait|hold|pause|пауз/.test(s)) return 'mp-tag-amber';
    return 'mp-tag-sky';
  }

  function getPriorityTagClass(priority) {
    const p = (priority || '').toLowerCase();
    if (/сроч|urgent|immediate|крит|critical|blocker/.test(p)) return 'mp-tag-coral';
    if (/высок|high/.test(p)) return 'mp-tag-amber';
    if (/низк|low/.test(p)) return 'mp-tag-slate';
    if (/норм|normal|medium|средн/.test(p)) return 'mp-tag-teal';
    return 'mp-tag-teal';
  }

  function getInitials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function avatarHue(id) {
    return PROJECT_HUES[(Number(id) * 17) % PROJECT_HUES.length];
  }

  function renderAssigneeAvatar(person, index, visibleCount) {
    const hue = avatarHue(person.id);
    const initials = escapeHtml(getInitials(person.name));
    const title = escapeHtml(person.name);
    const style = `--avatar-hue:${hue};z-index:${visibleCount - index}`;
    if (person.avatarUrl) {
      return `<span class="metask-avatar metask-avatar--photo" style="${style}" title="${title}">
        <img class="metask-avatar-img" src="${escapeHtml(person.avatarUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
        <span class="metask-avatar-fallback" aria-hidden="true">${initials}</span>
      </span>`;
    }
    return `<span class="metask-avatar" style="${style}" title="${title}">${initials}</span>`;
  }

  function bindAvatarImgFallbacks(root) {
    root?.querySelectorAll('.metask-avatar-img').forEach((img) => {
      const fail = () => {
        const wrap = img.closest('.metask-avatar');
        if (!wrap) return;
        wrap.classList.add('is-fallback');
        img.remove();
      };
      if (img.complete && img.naturalWidth === 0) fail();
      else img.addEventListener('error', fail, { once: true });
    });
  }

  function renderAssignees(assignees) {
    if (!assignees?.length) return '';
    const max = 4;
    const visible = assignees.slice(0, max);
    const extra = assignees.length - max;
    const avatars = visible.map((person, index) =>
      renderAssigneeAvatar(person, index, visible.length)
    ).join('');
    const more = extra > 0
      ? `<span class="metask-avatar metask-avatar-more" title="Ещё ${extra}">+${extra}</span>`
      : '';
    return `<span class="metask-assignees">${avatars}${more}</span>`;
  }

  function formatShortDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  function getAccentBarClass(status) {
    return getStatusTagClass(status);
  }

  function renderPrimaryAssignee(assignees) {
    if (!assignees?.length) return '';
    return `<span class="metask-item-person">${escapeHtml(assignees[0].name)}</span>`;
  }

  function formatUpdatedAt(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  function getUpdateTier(iso) {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 0) return null;
    if (diff < 6 * 60 * 60 * 1000) return 'hot';
    if (diff < 48 * 60 * 60 * 1000) return 'recent';
    return null;
  }

  function formatRelativeUpdate(iso) {
    if (!iso) return '';
    try {
      const diff = Date.now() - new Date(iso).getTime();
      if (diff < 60 * 1000) return 'только что';
      if (diff < 60 * 60 * 1000) {
        const m = Math.floor(diff / 60000);
        return `${m} мин. назад`;
      }
      if (diff < 24 * 60 * 60 * 1000) {
        const h = Math.floor(diff / 3600000);
        return `${h} ч. назад`;
      }
      return formatUpdatedAt(iso);
    } catch {
      return formatUpdatedAt(iso);
    }
  }

  let highlightedTaskIds = new Set();
  let activeTaskId = null;
  let lastTasks = [];

  function setActiveTaskId(id) {
    activeTaskId = id != null ? Number(id) : null;
    document.querySelectorAll('.metask-item').forEach((btn) => {
      const isActive = Number(btn.dataset.id) === activeTaskId;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  function normalizeBaseUrl(raw) {
    let s = (raw || '').trim();
    if (!s) return '';
    s = s.replace(/\/\/m\.cinet\.ru/gi, '//rm.cinet.ru');
    s = s.replace(/\/\/rm\.cinct\.ru/gi, '//rm.cinet.ru');
    s = s.replace(/\/kanban\b.*/i, '');
    try {
      const u = new URL(s.includes('://') ? s : `https://${s}`);
      if (u.hostname === 'm.cinet.ru') u.hostname = 'rm.cinet.ru';
      if (u.hostname === 'rm.cinct.ru') u.hostname = 'rm.cinet.ru';
      return `${u.protocol}//${u.host}`;
    } catch {
      return '';
    }
  }

  function normalizeBoardPath(raw) {
    const s = (raw || '/kanban/board').trim();
    if (!s) return '/kanban/board';
    return s.startsWith('/') ? s : `/${s}`;
  }

  function isConfigured(settings) {
    const s = settings || readCredentialsFromForm();
    return !!(normalizeBaseUrl(s.baseUrl) && ((s.apiKey || '').trim() || s.apiKeyConfigured));
  }

  function isAuthPanelVisible() {
    const auth = $('metask-auth');
    return !!auth && !auth.classList.contains('hidden');
  }

  function shouldAttachBoard() {
    return $('page-metask')?.classList.contains('active')
      && isConfigured()
      && !isAuthPanelVisible();
  }

  function syncAuthSetupState() {
    document.querySelector('.metask-page')
      ?.classList.toggle('metask-page--setup', isAuthPanelVisible() || !isConfigured());
  }

  function updateAuthVisibility(settings) {
    const auth = $('metask-auth');
    if (!auth) return;
    if (authPinnedOpen) {
      auth.classList.remove('hidden');
    } else {
      auth.classList.toggle('hidden', isConfigured(settings));
    }
    syncAuthSetupState();
  }

  function applyCredentialsToForm(settings) {
    const user = $('metask-username');
    const pass = $('metask-password');
    const url = $('metask-base-url');
    const path = $('metask-board-path');
    const key = $('metask-api-key');
    if (url) url.value = settings?.baseUrl ? normalizeBaseUrl(settings.baseUrl) : '';
    if (path) path.value = settings?.boardPath || '/kanban/board';
    if (user && settings?.username) user.value = settings.username;
    if (pass && settings?.password) pass.value = settings.password;
    if (key) {
      key.value = '';
      key.placeholder = settings?.apiKeyConfigured
        ? 'Ключ сохранён — введите новый только для замены'
        : 'Из «Моя учётная запись» в Redmine';
    }
    updateAuthVisibility(settings);
  }

  function readCredentialsFromForm() {
    const passInput = $('metask-password')?.value || '';
    return {
      baseUrl: normalizeBaseUrl($('metask-base-url')?.value),
      boardPath: normalizeBoardPath($('metask-board-path')?.value),
      username: $('metask-username')?.value?.trim() || '',
      password: passInput || savedMetaskSettings.password || '',
      apiKey: $('metask-api-key')?.value?.trim() || '',
    };
  }

  window.readKanbanCredentials = readCredentialsFromForm;
  window.applyKanbanCredentialsToForm = applyCredentialsToForm;

  function setStatus(text, ok) {
    const el = $('metask-status-text');
    const dot = $('metask-status-dot');
    const wrap = el?.closest('.webtab-status');
    if (el) {
      const raw = String(text || '');
      if (ok && raw.startsWith('Вошли как ')) {
        const name = raw.slice('Вошли как '.length);
        el.textContent = '';
        el.append('Вошли как ', Object.assign(document.createElement('strong'), { textContent: name }));
      } else {
        el.textContent = raw;
      }
    }
    if (dot) dot.classList.toggle('on', !!ok);
    wrap?.classList.toggle('is-online', !!ok);
  }

  function renderTasks(tasks) {
    lastTasks = tasks || [];
    const list = $('metask-list');
    const count = $('metask-task-count');
    if (!list) return;

    if (count) count.textContent = String(tasks?.length || 0);
    updateListPanelChrome(tasks?.length || 0);

    if (!tasks?.length) {
      list.innerHTML = '<div class="metask-empty">Нет активных задач: ни исполнитель, ни открытый чеклист</div>';
      return;
    }

    list.innerHTML = tasks.map((t) => {
      const tier = getUpdateTier(t.updatedOn);
      const justChanged = highlightedTaskIds.has(t.id);
      const classes = ['metask-item'];
      if (Number(t.id) === activeTaskId) classes.push('is-active');
      if (tier === 'hot' || justChanged) classes.push('is-hot');
      else if (tier === 'recent') classes.push('is-recent');
      if (justChanged) classes.push('is-changed');

      const accentClass = getAccentBarClass(t.status);
      const showChangeTag = tier === 'hot' || justChanged;

      return `
      <button type="button" class="${classes.join(' ')} metask-bar-${accentClass}" data-url="${escapeHtml(t.url)}" data-id="${t.id}" aria-current="${Number(t.id) === activeTaskId ? 'true' : 'false'}">
        <span class="metask-item-accent" aria-hidden="true"></span>
        <span class="metask-item-inner">
          <span class="metask-item-top">
            <span class="metask-item-top-left">
              ${t.tracker ? `<span class="metask-item-kind">${escapeHtml(t.tracker)}</span>` : ''}
              <span class="metask-item-id">#${t.id}</span>
            </span>
          </span>
          ${renderPrimaryAssignee(t.assignees)}
          ${t.updatedOn && !showChangeTag ? `<span class="metask-item-updated-line">Обновлено ${escapeHtml(formatRelativeUpdate(t.updatedOn))}</span>` : ''}
          ${t.project ? `<span class="metask-item-project">${escapeHtml(t.project.toUpperCase())}</span>` : ''}
          <span class="metask-item-subject">${escapeHtml(t.subject)}</span>
          ${t.involvement === 'checklist' && t.checklistItems?.length
            ? `<span class="metask-item-checklist" title="${escapeHtml(t.checklistItems.map((c) => c.title).join('\n'))}">☑ ${escapeHtml(t.checklistItems[0].title)}${t.checklistItems.length > 1 ? ` +${t.checklistItems.length - 1}` : ''}</span>`
            : ''}
          <span class="metask-item-meta">
            ${t.involvement === 'checklist' ? '<span class="metask-tag metask-tag-checklist">Чеклист</span>' : ''}
            ${showChangeTag && t.updatedOn ? `<span class="metask-tag metask-tag-change ${justChanged ? 'mp-tag-rose' : 'mp-tag-lavender'}" title="${escapeHtml(formatUpdatedAt(t.updatedOn))}">${justChanged ? 'Новое · ' : ''}${escapeHtml(formatRelativeUpdate(t.updatedOn))}</span>` : ''}
            <span class="metask-tag metask-tag-status ${getStatusTagClass(t.status)}">${escapeHtml(t.status)}</span>
            <span class="metask-tag metask-tag-priority ${getPriorityTagClass(t.priority)}">${escapeHtml(t.priority)}</span>
          </span>
          <span class="metask-item-footer">
            ${t.updatedOn ? `
            <span class="metask-item-date" title="${escapeHtml(formatUpdatedAt(t.updatedOn))}">
              <span class="metask-item-date-icon" aria-hidden="true"></span>
              ${escapeHtml(formatShortDate(t.updatedOn))}
            </span>` : '<span></span>'}
            ${renderAssignees(t.assignees)}
          </span>
        </span>
      </button>`;
    }).join('');

    bindAvatarImgFallbacks(list);

    list.querySelectorAll('.metask-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!btn.dataset.url) return;
        setActiveTaskId(btn.dataset.id);
        btn.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        window.api.metaskOpenIssue(btn.dataset.url);
      });
    });
  }

  async function detachBoard() {
    boardAttached = false;
    if (window.api.metaskDetachBoard) await window.api.metaskDetachBoard();
  }

  async function attachBoard() {
    if (!window.api.metaskAttachBoard) return;
    if (!shouldAttachBoard()) {
      await detachBoard();
      return;
    }
    if (!boardAttached) {
      await window.api.metaskAttachBoard();
      boardAttached = true;
    } else {
      await window.api.metaskResizeBoard();
    }
  }

  let boardLayoutTimer = null;
  let resizeRaf = null;

  function scheduleBoardLayout() {
    if (boardLayoutTimer) clearTimeout(boardLayoutTimer);
    boardLayoutTimer = setTimeout(() => {
      boardLayoutTimer = null;
      requestAnimationFrame(() => attachBoard());
    }, 32);
  }

  function setupBoardResizeObserver() {
    const host = $('metask-board-host');
    if (!host || !window.api.metaskAttachBoard) return;
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        if (!$('page-metask')?.classList.contains('active')) return;
        if (boardLayoutAnimFrame) return;
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = null;
          attachBoard();
        });
      });
      resizeObserver.observe(host);
    }
    const panel = host.closest('.metask-split');
    if (panel) resizeObserver.observe(panel);
    const seam = $('metask-list-expand-seam');
    if (seam) {
      resizeObserver.observe(seam);
      seam.addEventListener('transitionend', (event) => {
        if (event.propertyName === 'width' || event.propertyName === 'height') {
          attachBoard();
        }
      });
    }
    const listPanel = document.querySelector('.metask-list-panel');
    if (listPanel) {
      resizeObserver.observe(listPanel);
      listPanel.addEventListener('transitionend', (event) => {
        if (event.propertyName === 'width' || event.propertyName === 'height') {
          attachBoard();
        }
      });
    }
    const auth = $('metask-auth');
    if (auth) {
      resizeObserver.observe(auth);
    }
  }

  async function openMetaskTask(id, url) {
    const taskId = Number(id);
    if (!taskId) return;

    const taskUrl = url || lastTasks.find((t) => t.id === taskId)?.url;
    const onMetask = $('page-metask')?.classList.contains('active');

    if (!onMetask) {
      document.querySelector('.nav-item[data-page="metask"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    setActiveTaskId(taskId);
    if (taskUrl) window.api.metaskOpenIssue(taskUrl);

    requestAnimationFrame(() => {
      document.querySelector(`.metask-item[data-id="${taskId}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function applySyncResult(result) {
    if (result?.updates?.length) {
      window.handleKanbanTaskUpdates?.(result.updates);
      highlightedTaskIds = new Set(result.updates.map((t) => t.id));
      setTimeout(() => {
        highlightedTaskIds = new Set();
        if (result?.tasks?.length) renderTasks(result.tasks);
      }, 120000);
    }
    if (result?.user) {
      setStatus(`Вошли как ${result.user}`, true);
    } else if (result?.tasks?.length) {
      setStatus(`Задач: ${result.tasks.length}`, true);
    } else if (result?.loggedIn) {
      setStatus('Подключено', true);
    }
    renderTasks(result?.tasks || []);
  }

  async function syncTasks() {
    if (syncing) return;
    const creds = readCredentialsFromForm();

    if (!creds.baseUrl) {
      updateAuthVisibility({});
      $('metask-list').innerHTML = '<div class="metask-empty">Укажите URL сервера Redmine и нажмите «Подключить»</div>';
      setStatus('Нужен URL Redmine', false);
      return;
    }
    if (!creds.apiKey) {
      updateAuthVisibility({});
      $('metask-list').innerHTML = '<div class="metask-empty">Вставьте API-ключ Redmine — без него список задач не загрузится</div>';
      setStatus('Нужен API-ключ', false);
      return;
    }

    syncing = true;
    setStatus('Загрузка…', false);
    $('metask-list').innerHTML = '<div class="metask-empty">Загрузка задач…</div>';
    await detachBoard();

    try {
      const saved = await window.api.metaskSaveCredentials(creds);
      savedMetaskSettings = saved || creds;
      applyCredentialsToForm(savedMetaskSettings);
      authPinnedOpen = false;
      updateAuthVisibility(savedMetaskSettings);

      const result = await window.api.metaskSync();
      if (!result?.ok) {
        throw new Error(result?.message || result?.lastError || 'Ошибка синхронизации');
      }

      applySyncResult(result);

      if (!result.tasks?.length) {
        const err = result.lastError ? `<br><span class="metask-empty">${escapeHtml(result.lastError)}</span>` : '';
        $('metask-list').innerHTML = `<div class="metask-error">Активных задач не найдено (исполнитель или чеклист)${err}</div>`;
        setStatus('Нет задач', false);
      }
      scheduleBoardLayout();
    } catch (err) {
      authPinnedOpen = true;
      updateAuthVisibility({});
      $('metask-list').innerHTML = `<div class="metask-error">${escapeHtml(err.message || 'Не удалось загрузить')}</div>`;
      setStatus('Ошибка', false);
    } finally {
      syncing = false;
    }
  }

  async function activateMetaskPage() {
    setupBoardResizeObserver();
    try {
      const info = await window.api.metaskGetInfo();
      savedMetaskSettings = info?.settings || {};
      applyCredentialsToForm(savedMetaskSettings);
    } catch { /* ignore */ }

    await detachBoard();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    if (isConfigured()) {
      await syncTasks();
    } else {
      authPinnedOpen = false;
      updateAuthVisibility({});
      $('metask-list').innerHTML = '<div class="metask-empty">Настройте подключение Redmine — URL и API-ключ</div>';
      setStatus('Не подключено', false);
    }
    scheduleBoardLayout();
    setTimeout(() => window.api.metaskResizeBoard?.(), 120);
  }

  async function detachMetaskBoard() {
    boardAttached = false;
    if (window.api.metaskDetachBoard) await window.api.metaskDetachBoard();
  }

  function bindEvents() {
    $('metask-refresh')?.addEventListener('click', syncTasks);
    $('metask-save-login')?.addEventListener('click', syncTasks);
    $('metask-toggle-auth')?.addEventListener('click', async () => {
      const auth = $('metask-auth');
      const willShow = auth?.classList.contains('hidden');
      authPinnedOpen = willShow;
      auth?.classList.toggle('hidden');
      syncAuthSetupState();
      if (willShow) {
        await detachBoard();
      } else {
        authPinnedOpen = false;
        updateAuthVisibility(readCredentialsFromForm());
        scheduleBoardLayout();
      }
    });
    $('metask-open-board')?.addEventListener('click', async () => {
      const creds = readCredentialsFromForm();
      if (!creds.baseUrl) {
        $('metask-auth')?.classList.remove('hidden');
        setStatus('Сначала укажите URL', false);
        return;
      }
      const info = await window.api.metaskGetInfo();
      const url = info?.boardUrl || `${creds.baseUrl}${creds.boardPath}`;
      window.api.metaskOpenExternal(url);
    });

    $('metask-list-collapse')?.addEventListener('click', () => setListPanelCollapsed(true));
    $('metask-list-expand-seam')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      expandListPanel();
    });

    window.api.onMetaskWindowResized?.(() => {
      if ($('page-metask')?.classList.contains('active')) scheduleBoardLayout();
    });

    window.api.onMetaskTasksUpdated?.((result) => {
      applySyncResult(result);
    });

    window.api.onMetaskSessionReady?.(() => {
      setStatus('Доска подключена', true);
    });

    window.api.onMetaskIssueActive?.(({ id }) => {
      setActiveTaskId(id);
    });

    window.addEventListener('resize', () => {
      if ($('page-metask')?.classList.contains('active')) scheduleBoardLayout();
    });
  }

  async function initMetask() {
    bindEvents();
    restoreListPanelCollapsed();
    try {
      const info = await window.api.metaskGetInfo();
      savedMetaskSettings = info?.settings || {};
      applyCredentialsToForm(savedMetaskSettings);
      if (!isConfigured(savedMetaskSettings)) {
        $('metask-list').innerHTML = '<div class="metask-empty">Настройте подключение Redmine — URL и API-ключ</div>';
        setStatus('Не подключено', false);
      }
    } catch { /* ignore */ }
  }

  window.initMetask = initMetask;
  window.activateMetaskPage = activateMetaskPage;
  window.detachMetaskBoard = detachMetaskBoard;
  window.openMetaskTask = openMetaskTask;
  window.getMetaskCachedTasks = () => (lastTasks?.length ? lastTasks.slice() : []);
})();
