let config = null;
let actions = [];
let actionMeta = {};
let editingId = null;
let editKeys = [];
let activeFilter = 'all';
let currentDetailId = null;
let lastCursorRow = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const CATEGORY_ICONS = {
  'Выравнивание': '⊕',
  'Размер': '⤢',
  'Распределение': '⇹',
  'Стиль': '◑',
  'Layout': '▦',
  'Создание': '✦',
};

function initPillNotifyInApp() {
  const handleAction = (action) => {
    if (!action || typeof action !== 'object') return;
    if (action.type === 'metask-open-task') {
      window.openMetaskTask?.(action.id, action.url);
      return;
    }
    if (action.type === 'focus-agent') {
      document.querySelector('.nav-item[data-page="agent"]')?.click();
      return;
    }
    if (action.type === 'konstancia-open-share') {
      window.openKonstanciaShare?.(action.shareId);
    }
  };

  window.api.onKonstanciaOpenShare?.((payload) => {
    window.openKonstanciaShare?.(payload?.shareId);
  });

  window.api.onPillNotifyInApp?.((item) => {
    const stack = document.getElementById('pill-notify-inapp-stack');
    if (!stack || !window.PillNotifyUI) return;
    window.PillNotifyUI.showPill(stack, {
      title: item?.title,
      subtitle: item?.subtitle,
      body: item?.body || item?.subtitle,
      meta: item?.meta,
      badge: item?.badge,
      tag: item?.tag,
      tags: item?.tags,
      imageUrl: item?.imageUrl || item?.thumbUrl,
      icon: item?.icon || 'spark',
      durationMs: item?.durationMs ?? 12000,
      action: item?.action,
      onClick: () => handleAction(item?.action),
    });
  });

  window.api.onPillNotifyFocusAgent?.(() => {
    document.querySelector('.nav-item[data-page="agent"]')?.click();
  });
}

async function init() {
  initPillNotifyInApp();
  const auth = await window.initAuthGate?.();
  config = auth?.config || await window.api.getConfig();
  window.__APP_CONFIG__ = config;
  actions = await window.api.getActions();
  actionMeta = await window.api.getActionMeta();
  window.customThemeEngine?.injectCustomThemeStyles(config);
  applyTheme(config.theme || 'mobbin');
  window.applyAppSettings?.(config.settings);
  await window.initRoleNav?.(config, { requirePicker: !auth?.profile });
  updateStatus(await window.api.getStatus());
  initKanbanNotify({ getConfig: () => config });
  renderHotkeys();
  populateActionSelect();
  setupCustomCursor();

  window.api.onStatus(updateStatus);
  window.api.onLog((msg) => {
    $('#log-text').textContent = msg;
  });
  window.api.onConfig((c) => {
    config = c;
    window.__APP_CONFIG__ = c;
    window.customThemeEngine?.injectCustomThemeStyles(c);
    window.applyAppSettings?.(c.settings);
    window.RoleNav?.applyRoleNav?.(c.settings?.user?.role);
    window.refreshCustomThemesUi?.(c);
    renderHotkeys();
    window.rebuildSearchIndex?.();
  });
  bindEvents();
  initSettings();
  initTemplates();
  window.initAgent?.();
  window.initNanobanana?.();
  window.initBannerMockup?.();
  window.initMetask?.();
  window.initMail?.();
  window.initWebtabs?.();
  window.initNotes?.();
  initGlobalSearch(() => ({ config, actions, actionMeta }));
  initOnboarding(config);
}

window.applyTheme = applyTheme;

function applyTheme(theme) {
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePref = theme;

  $$('.theme-card').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  syncSidebarCharacterMedia(resolved, config);
}

async function syncSidebarCharacterMedia(theme, cfg = config) {
  if (window.customThemeEngine?.applySidebarMedia) {
    await window.customThemeEngine.applySidebarMedia(theme, cfg);
    return;
  }
  const vid = document.querySelector('.sidebar-character-vid');
  if (!vid) return;
  if (theme === 'mangaplus') {
    vid.play().catch(() => {});
  } else {
    vid.pause();
    vid.currentTime = 0;
  }
}

function updateStatus(s) {
  $('#dot-server').className = 'dot-sm ' + (s.running ? 'on' : '');
  $('#dot-figma').className = 'dot-sm ' + (s.figmaConnected ? 'on' : '');

  const pillH = $('#pill-hotkeys');
  const pillF = $('#pill-figma');
  if (pillH) pillH.style.opacity = s.running ? '1' : '0.5';
  if (pillF) pillF.style.opacity = s.figmaConnected ? '1' : '0.5';

  $('#toggle-server').checked = s.running;

  const portHint = $('#plugin-port-hint');
  if (portHint && s.pluginPort) {
    portHint.textContent = 'Порт плагина: ' + s.pluginPort + ' (укажите в окне плагина Figma)';
  }

  const cs = $('#connect-status');
  if (cs) {
    if (s.pluginConnected) {
      cs.textContent = '✓ Плагин подключён — хоткеи работают';
      cs.className = 'connect-status ok';
    } else if (s.cdpReady) {
      cs.textContent = '✓ Figma CDP подключена';
      cs.className = 'connect-status ok';
    } else if (s.figmaConnected) {
      cs.textContent = 'CDP активен — запустите плагин в Figma';
      cs.className = 'connect-status';
    } else {
      cs.textContent = 'Figma не подключена — запустите плагин';
      cs.className = 'connect-status';
    }
  }

  const barIcon = $('#bar-icon');
  const barTitle = $('#bar-title');
  if (s.pluginConnected) {
    barIcon.textContent = '🎨';
    barTitle.textContent = 'Плагин Figma подключён';
  } else if (s.cdpReady) {
    barIcon.textContent = '🎨';
    barTitle.textContent = 'Figma подключена';
  } else if (s.running) {
    barIcon.textContent = '⌨';
    barTitle.textContent = 'Хоткеи активны';
  } else {
    barIcon.textContent = '⏸';
    barTitle.textContent = 'Хоткеи выключены';
  }
}

function actionName(id) {
  return actions.find((a) => a.id === id)?.name || id;
}

function actionCategory(id) {
  return actions.find((a) => a.id === id)?.category || '';
}

async function formatCombo(keys) {
  if (!keys?.length) return '—';
  return window.api.formatKeys(keys);
}

function getFilteredHotkeys() {
  let list = config.hotkeys || [];
  if (activeFilter !== 'all') {
    list = list.filter((hk) => actionCategory(hk.action) === activeFilter);
  }
  return list;
}

async function renderHotkeys() {
  const list = getFilteredHotkeys();
  const container = $('#hotkey-list');
  container.innerHTML = '';

  const total = (config.hotkeys || []).length;
  const countEl = $('#hotkey-count');
  countEl.textContent = total + ' ' + plural(total, 'команда', 'команды', 'команд');
  countEl.classList.remove('is-updating');
  void countEl.offsetWidth;
  countEl.classList.add('is-updating');

  if (list.length === 0) {
    $('#empty-state').classList.remove('hidden');
    $('#page-hotkeys .list-header')?.classList.add('hidden');
    return;
  }
  $('#empty-state').classList.add('hidden');
  $('#page-hotkeys .list-header')?.classList.remove('hidden');

  let rowIndex = 0;
  for (const hk of list) {
    const combo = await formatCombo(hk.keys);
    const conflict = await window.api.checkConflict(hk.keys, hk.id);
    const cat = actionCategory(hk.action);
    const icon = CATEGORY_ICONS[cat] || '⌨';

    const row = document.createElement('div');
    row.className = 'hotkey-row hotkey-row--enter';
    row.style.setProperty('--row-i', rowIndex++);
    row.dataset.id = hk.id;
    row.innerHTML = `
      <div class="row-main">
        <div class="row-icon">${icon}</div>
        <div class="row-text">
          <div class="row-title">${escapeHtml(hk.name)}</div>
          <div class="row-sub">${escapeHtml(actionName(hk.action))}</div>
        </div>
      </div>
      <div><span class="combo-badge ${conflict ? 'warn' : ''}">${combo}</span></div>
      <div class="row-actions">
        <button class="icon-btn" data-test="${hk.action}" title="Тест">▶</button>
        <button class="icon-btn" data-edit="${hk.id}" title="Изменить">✎</button>
        <button class="icon-btn" data-delete="${hk.id}" title="Удалить">🗑</button>
      </div>`;
    container.appendChild(row);

    row.addEventListener('click', (e) => {
      if (e.target.closest('.row-actions')) return;
      openHotkeyDetail(hk.id);
    });
  }

  container.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.onclick = (e) => { e.stopPropagation(); openModal(btn.dataset.edit); }
  );
  container.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.onclick = (e) => { e.stopPropagation(); deleteHotkey(btn.dataset.delete); }
  );
  container.querySelectorAll('[data-test]').forEach((btn) =>
    btn.onclick = (e) => { e.stopPropagation(); window.api.testAction(btn.dataset.test); }
  );
}

function plural(n, one, few, many) {
  const m = n % 10, h = n % 100;
  if (h >= 11 && h <= 19) return many;
  if (m === 1) return one;
  if (m >= 2 && m <= 4) return few;
  return many;
}

function populateActionSelect() {
  const sel = $('#edit-action');
  const categories = [...new Set(actions.map((a) => a.category))];
  sel.innerHTML = '';
  for (const cat of categories) {
    const group = document.createElement('optgroup');
    group.label = cat;
    for (const a of actions.filter((x) => x.category === cat)) {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      group.appendChild(opt);
    }
    sel.appendChild(group);
  }
}

async function connectFigma(btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Подключение...</span>';
  }
  try {
    const r = await window.api.connectFigma();
    $('#log-text').textContent = r.message || 'Готово';
    updateStatus(await window.api.getStatus());
  } catch (e) {
    $('#log-text').textContent = e.message || 'Ошибка подключения';
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Запустить Figma';
  }
}

function setupCustomCursor() {
  document.addEventListener('mousemove', (e) => {
    const cursor = $('#custom-cursor');
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });

  const list = $('#hotkey-list');
  list.addEventListener('mousemove', (e) => {
    const row = e.target.closest('.hotkey-row');
    if (!row || e.target.closest('.row-actions')) {
      lastCursorRow = null;
      setCustomCursorVisible(false);
      return;
    }
    const bounce = row !== lastCursorRow;
    lastCursorRow = row;
    setCustomCursorVisible(true, bounce);
  });
  list.addEventListener('mouseleave', () => {
    lastCursorRow = null;
    setCustomCursorVisible(false);
  });
}

function setCustomCursorVisible(visible, bounce = false) {
  const cursor = $('#custom-cursor');
  const list = $('#hotkey-list');
  if (!visible) {
    list.classList.remove('cursor-custom');
    cursor.classList.add('hidden');
    cursor.classList.remove('active', 'bounce');
    return;
  }
  list.classList.add('cursor-custom');
  cursor.classList.remove('hidden');
  cursor.classList.add('active');
  if (bounce) {
    cursor.classList.remove('bounce');
    void cursor.offsetWidth;
    cursor.classList.add('bounce');
  }
}

function hideCustomCursor() {
  lastCursorRow = null;
  setCustomCursorVisible(false);
}

async function openHotkeyDetail(id) {
  const hk = (config.hotkeys || []).find((h) => h.id === id);
  if (!hk) return;

  currentDetailId = id;
  hideCustomCursor();

  const meta = actionMeta[hk.action] || {};
  const combo = await formatCombo(hk.keys);
  const cat = actionCategory(hk.action);

  $('#detail-title').textContent = hk.name;
  $('#detail-category').textContent = cat || 'Команда';
  renderDetailCombo(combo);
  $('#detail-desc').textContent = meta.description || hk.hint || actionName(hk.action);
  $('#detail-why').textContent = meta.whyUseful || 'Экономит время при ежедневной работе в Figma.';
  $('#detail-demo').innerHTML = window.renderDemo(meta.demo || 'center-both', combo);

  $$('.page').forEach((p) => p.classList.remove('active'));
  const detailPage = $('#page-hotkey-detail');
  detailPage.classList.remove('is-entering');
  void detailPage.offsetWidth;
  detailPage.classList.add('active', 'is-entering');
}
window.openHotkeyDetail = openHotkeyDetail;

function renderDetailCombo(combo) {
  const el = $('#detail-combo');
  if (!el) return;
  const keys = String(combo || '').split(/\s*\+\s*/).filter(Boolean);
  if (keys.length <= 1) {
    el.innerHTML = `<kbd class="detail-combo-key">${escapeHtml(String(combo || ''))}</kbd>`;
    return;
  }
  el.innerHTML = keys.map((key, i) => {
    const plus = i > 0 ? '<span class="detail-combo-plus" aria-hidden="true">+</span>' : '';
    return `${plus}<kbd class="detail-combo-key">${escapeHtml(key.trim())}</kbd>`;
  }).join('');
}

function backToHotkeys() {
  currentDetailId = null;
  $('#page-hotkey-detail').classList.remove('active');
  $('#page-hotkeys').classList.add('active');
  $$('.nav-item').forEach((b) => b.classList.remove('active'));
  $('.nav-item[data-page="hotkeys"]')?.classList.add('active');
}
window.backToHotkeys = backToHotkeys;

function bindEvents() {
  $$('.nav-item').forEach((btn) => {
    btn.onclick = () => {
      hideCustomCursor();
      if (currentDetailId) currentDetailId = null;
      $$('.nav-item').forEach((b) => b.classList.remove('active'));
      $$('.page').forEach((p) => p.classList.remove('active'));
      if (btn.dataset.page !== 'metask') window.detachMetaskBoard?.();
      if (btn.dataset.page !== 'mail') window.detachMailView?.();
      if (btn.dataset.page !== 'teamchat') window.deactivateTeamChatPage?.();
      btn.classList.add('active');
      $(`#page-${btn.dataset.page}`).classList.add('active');
      if (btn.dataset.page === 'metask') window.activateMetaskPage?.();
      if (btn.dataset.page === 'agent') window.activateAgentPage?.();
      if (btn.dataset.page === 'teamchat') window.activateTeamChatPage?.();
      if (btn.dataset.page === 'nanobanana') window.activateNanobananaPage?.();
      if (btn.dataset.page === 'magnific') window.activateMagnificPage?.();
      if (btn.dataset.page === 'bannermockup') window.activateBannerMockupPage?.();
      if (btn.dataset.page === 'mail') window.activateMailPage?.();
      if (btn.dataset.page === 'github' || btn.dataset.page === 'outline') window.activateWebtab?.(btn.dataset.page);
      if (btn.dataset.page === 'notes') window.activateNotesPage?.();
      if (btn.dataset.page === 'search') window.activateSearchPage?.();
      if (btn.dataset.page === 'pikfolder') window.activatePikFolderPage?.();
    };
  });

  $('#detail-back').onclick = backToHotkeys;

  $$('.chip').forEach((chip) => {
    chip.onclick = () => {
      if (chip.classList.contains('active')) return;
      $$('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      const listEl = $('#hotkey-list');
      listEl.classList.add('is-filtering');
      renderHotkeys().then(() => {
        requestAnimationFrame(() => listEl.classList.remove('is-filtering'));
      });
    };
  });

  $('#btn-add-hotkey').onclick = () => openModal(null);
  $('#btn-keyboard-map')?.addEventListener('click', () => window.api.openKeyboardMapper?.());
  $('#btn-add-empty')?.addEventListener('click', () => openModal(null));
  $('#modal-close').onclick = closeModal;
  $('#modal-cancel').onclick = closeModal;
  $('#modal-overlay').onclick = (e) => { if (e.target === e.currentTarget) closeModal(); };
  $('#modal-save').onclick = saveModal;

  $('#edit-name').oninput = validateModal;
  $('#edit-action').onchange = () => {
    if (!$('#edit-name').value) {
      const a = actions.find((x) => x.id === $('#edit-action').value);
      if (a) $('#edit-name').value = a.name;
    }
    validateModal();
  };

  $('#btn-record').onclick = startRecord;

  $('#btn-connect-figma').onclick = () => connectFigma($('#btn-connect-figma'));
  $('#btn-quick-connect').onclick = () => connectFigma(null);
  bindSidebarUpdater();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((config.theme || 'mobbin') === 'system') applyTheme('system');
  });
}

let updateReadyVersion = '';
let updatePageReturnTo = 'search';

function openUpdatePage() {
  const page = $('#page-update');
  if (!page) return;

  // Запомним активную страницу, чтобы кнопка «Позже» вернула обратно.
  const current = $$('.nav-item.active')[0];
  if (current?.dataset.page) updatePageReturnTo = current.dataset.page;

  hideCustomCursor?.();
  window.detachMetaskBoard?.();
  window.detachMailView?.();
  $$('.nav-item').forEach((b) => b.classList.remove('active'));
  $$('.page').forEach((p) => p.classList.remove('active'));
  page.classList.add('active');

  fillUpdatePage(updateReadyVersion);
}
window.openUpdatePage = openUpdatePage;

async function fillUpdatePage(version) {
  const next = $('#upd-next');
  const badge = $('#upd-version-badge');
  if (next) next.textContent = version ? `v${version}` : '—';
  if (badge) badge.textContent = version ? `v${version}` : 'NEW';
  const currentEl = $('#upd-current');
  if (currentEl) {
    try {
      const v = await window.api.getAppVersion?.();
      currentEl.textContent = v ? `v${v}` : '—';
    } catch {
      currentEl.textContent = '—';
    }
  }
}

function leaveUpdatePage() {
  const target = $(`.nav-item[data-page="${updatePageReturnTo}"]`) || $('.nav-item[data-page="search"]');
  if (target) {
    target.click();
  } else {
    $('#page-update')?.classList.remove('active');
  }
}

function bindUpdatePage() {
  const installBtn = $('#upd-install');
  const laterBtn = $('#upd-later');
  const label = $('#upd-install-label');
  const note = $('#upd-note');

  installBtn?.addEventListener('click', async () => {
    installBtn.disabled = true;
    installBtn.classList.add('is-installing');
    if (label) label.textContent = 'Устанавливаем…';
    if (note) note.textContent = 'Закрываем приложение и применяем обновление. Сейчас оно перезапустится.';
    await window.api.updaterInstallNow?.();
  });

  laterBtn?.addEventListener('click', leaveUpdatePage);
}

function bindSidebarUpdater() {
  const wrap = $('#sidebar-update-wrap');
  const btn = $('#sidebar-update-btn');
  const status = $('#sidebar-update-status');
  const label = $('#sidebar-update-label');
  if (!wrap || !btn) return;

  // Кнопка появляется ТОЛЬКО когда обновление точно скачано и готово к установке.
  function hideUpdate() {
    wrap.classList.add('hidden');
    wrap.classList.remove('is-ready');
  }

  function showUpdateReady(version) {
    updateReadyVersion = version || updateReadyVersion;
    wrap.classList.remove('hidden');
    wrap.classList.add('is-ready');
    if (label) label.textContent = 'Обновить приложение';
    if (status) {
      status.textContent = updateReadyVersion
        ? `Версия ${updateReadyVersion} готова`
        : 'Обновление готово';
    }
    // Если страница обновления открыта — обновим данные на ней.
    if ($('#page-update')?.classList.contains('active')) fillUpdatePage(updateReadyVersion);
  }

  function setStatus(payload = {}) {
    if (payload.state === 'downloaded') {
      showUpdateReady(payload.info?.version);
      return;
    }
    hideUpdate();
  }

  // Клик по пилюле открывает отдельную страницу обновления (а не ставит сразу).
  btn.addEventListener('click', openUpdatePage);

  hideUpdate();
  bindUpdatePage();
  window.api.onUpdaterStatus?.(setStatus);
}

function openModal(id) {
  editingId = id;
  editKeys = [];
  const hk = id ? config.hotkeys.find((h) => h.id === id) : null;

  $('#modal-title').textContent = hk ? 'Редактировать' : 'Новый хоткей';
  $('#edit-name').value = hk?.name || '';
  $('#edit-action').value = hk?.action || actions[0]?.id || '';
  $('#edit-hint').value = hk?.hint || '';
  editKeys = hk?.keys ? [...hk.keys] : [];
  updateComboDisplay();
  $('#conflict-msg').classList.add('hidden');
  validateModal();
  $('#modal-overlay').classList.remove('hidden');
}

function closeModal() {
  $('#modal-overlay').classList.add('hidden');
  window.api.stopRecording();
  editingId = null;
  editKeys = [];
}

async function updateComboDisplay() {
  const el = $('#combo-display');
  if (editKeys.length === 0) {
    el.textContent = 'Не назначено';
    return;
  }
  el.textContent = await window.api.formatKeys(editKeys);
  const conflict = await window.api.checkConflict(editKeys, editingId);
  const msg = $('#conflict-msg');
  if (conflict) {
    msg.textContent = '⚠ ' + conflict.message;
    msg.className = 'conflict ' + conflict.type;
    msg.classList.remove('hidden');
  } else {
    msg.classList.add('hidden');
  }
}

async function validateModal() {
  const valid = $('#edit-name').value.trim() && editKeys.length > 0 && $('#edit-action').value;
  const conflict = editKeys.length ? await window.api.checkConflict(editKeys, editingId) : null;
  $('#modal-save').disabled = !valid || !!conflict;
}

async function startRecord() {
  const el = $('#combo-display');
  el.classList.add('recording');
  el.textContent = 'Нажмите комбинацию...';
  $('#btn-record').disabled = true;

  const combo = await window.api.startRecording();

  el.classList.remove('recording');
  $('#btn-record').disabled = false;

  if (combo?.length) editKeys = combo;
  await updateComboDisplay();
  validateModal();
}

async function saveModal() {
  const hotkey = {
    id: editingId || undefined,
    name: $('#edit-name').value.trim(),
    action: $('#edit-action').value,
    keys: editKeys,
    hint: $('#edit-hint').value.trim() || undefined,
  };
  config = await window.api.saveHotkey(hotkey);
  closeModal();
  renderHotkeys();
  window.rebuildSearchIndex?.();
}

async function deleteHotkey(id) {
  if (!confirm('Удалить этот хоткей?')) return;
  config = await window.api.deleteHotkey(id);
  renderHotkeys();
  window.rebuildSearchIndex?.();
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

init();
