(function () {
  const MODIFIERS = new Set([
    'LEFT CTRL', 'RIGHT CTRL', 'LEFT ALT', 'RIGHT ALT', 'LEFT SHIFT', 'RIGHT SHIFT',
    'LEFT META', 'RIGHT META', 'LEFT WIN', 'RIGHT WIN',
  ]);

  const MOD_ORDER = ['LEFT CTRL', 'RIGHT CTRL', 'LEFT ALT', 'RIGHT ALT', 'LEFT SHIFT', 'RIGHT SHIFT'];

  let config = { hotkeys: [] };
  let actions = [];
  let mods = { ctrl: false, alt: true, shift: false };
  let selectedKey = null;
  let editingHotkeyId = null;

  const $ = (sel) => document.querySelector(sel);

  function normalizeCombo(keys) {
    const modsList = keys.filter((k) => MODIFIERS.has(k));
    const main = keys.filter((k) => !MODIFIERS.has(k));
    modsList.sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b));
    return [...modsList, ...main];
  }

  function comboAlias(key) {
    return key.replace(/^LEFT /, '').replace(/^RIGHT /, '');
  }

  function comboSignature(keys) {
    return normalizeCombo(keys).map(comboAlias).join('|');
  }

  function combosEqual(a, b) {
    return comboSignature(a) === comboSignature(b);
  }

  function activeModifierKeys() {
    const keys = [];
    if (mods.ctrl) keys.push('LEFT CTRL');
    if (mods.alt) keys.push('LEFT ALT');
    if (mods.shift) keys.push('LEFT SHIFT');
    return keys;
  }

  function buildCombo(mainCode) {
    return normalizeCombo([...activeModifierKeys(), mainCode]);
  }

  function keyCodesForDef(def) {
    const list = [def.code, ...(def.altCodes || [])];
    return [...new Set(list.filter(Boolean))];
  }

  function findHotkeyForCombo(combo) {
    return config.hotkeys.find((hk) => combosEqual(hk.keys, combo));
  }

  function findHotkeyOnKey(def) {
    for (const code of keyCodesForDef(def)) {
      const hk = findHotkeyForCombo(buildCombo(code));
      if (hk) return hk;
    }
    return null;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderKeyButton(item) {
    if (item.gap != null) {
      return `<span class="kb-gap" style="--gw:${item.gap}"></span>`;
    }
    if (item.spacer) {
      return `<span class="kb-spacer" style="--w:${item.w || 1}"></span>`;
    }

    const codes = keyCodesForDef(item);
    const primaryCode = codes[0];
    const hk = findHotkeyOnKey(item);
    const assigned = !!hk;
    const isModKey = item.modifier;
    const modActive = isModKey && mods[item.modifier];
    const isSelected = selectedKey && codes.includes(selectedKey);
    const wide = (item.w || 1) >= 2;

    let classes = 'kb-key';
    if (wide) classes += ' is-wide';
    if (item.rowSpan > 1) classes += ' is-tall';
    if (assigned) classes += ' is-assigned';
    if (modActive) classes += ' is-mod-on';
    if (isSelected) classes += ' is-selected';

    const actionDot = assigned ? '<span class="kb-key-dot" aria-hidden="true"></span>' : '';
    const title = assigned ? hk.name : (item.label || primaryCode);

    const gridStyle = item.col != null
      ? ` style="grid-column:${item.col + 1} / span ${item.colSpan || 1}; grid-row:${item.row + 1} / span ${item.rowSpan || 1}"`
      : ` style="--w:${item.w || 1}"`;

    return `
      <button
        type="button"
        class="${classes}"
        ${gridStyle}
        data-code="${escapeHtml(primaryCode)}"
        data-modifier="${item.modifier || ''}"
        title="${escapeHtml(title)}"
      >
        <span class="kb-key-label">${escapeHtml(item.label)}</span>
        ${actionDot}
      </button>`;
  }

  function renderNavRow(row) {
    const keysHtml = row.map((item) => renderKeyButton(item)).join('');
    return `<div class="kb-row-fixed">${keysHtml}</div>`;
  }

  function renderNavArrows(cells) {
    if (!cells?.length) return '';
    const html = cells.map((item) => {
      if (!item) return '<span class="kb-key-empty"></span>';
      return renderKeyButton(item);
    }).join('');
    return `<div class="kb-arrows">${html}</div>`;
  }

  function renderRow(row) {
    const keysHtml = row.map((item) => renderKeyButton(item)).join('');
    return `<div class="kb-row">${keysHtml}</div>`;
  }

  function renderBoard() {
    const board = $('#kb-board');
    const layout = window.KB_LAYOUT;
    if (!board || !layout) return;

    // Legacy flat array fallback
    if (Array.isArray(layout)) {
      board.innerHTML = layout.map((row) => renderRow(row)).join('');
      bindKeyButtons(board);
      return;
    }

    const mainHtml = (layout.main || []).map((row) => renderRow(row)).join('');
    const navHtml = (layout.nav || []).map((row) => renderNavRow(row)).join('');
    const arrowsHtml = renderNavArrows(layout.navArrows);
    const numpadKeysHtml = (layout.numpad || []).map((item) => renderKeyButton(item)).join('');

    board.innerHTML = `
      <div class="kb-zones">
        <div class="kb-zone-main">${mainHtml}</div>
        <div class="kb-zone-nav">${navHtml}${arrowsHtml}</div>
        <div class="kb-zone-numpad">${numpadKeysHtml}</div>
      </div>`;

    bindKeyButtons(board);
  }

  function bindKeyButtons(board) {
    board.querySelectorAll('.kb-key').forEach((btn) => {
      btn.addEventListener('click', () => onKeyClick(btn.dataset.code, btn.dataset.modifier));
    });
  }

  function syncModButtons() {
    document.querySelectorAll('.kb-mod').forEach((btn) => {
      btn.classList.toggle('active', !!mods[btn.dataset.mod]);
    });
  }

  function onKeyClick(code, modifierKind) {
    if (modifierKind && ['ctrl', 'alt', 'shift'].includes(modifierKind)) {
      mods[modifierKind] = !mods[modifierKind];
      syncModButtons();
      renderBoard();
      if (selectedKey && !MODIFIERS.has(selectedKey)) {
        openPanelForKey(selectedKey);
      }
      return;
    }

    if (MODIFIERS.has(code)) return;

    selectedKey = code;
    renderBoard();
    openPanelForKey(code);
  }

  async function openPanelForKey(code) {
    const combo = buildCombo(code);
    const hk = findHotkeyForCombo(combo);
    editingHotkeyId = hk?.id || null;

    $('#kb-panel-empty').classList.add('hidden');
    $('#kb-panel-form').classList.remove('hidden');

    const comboText = await window.api.formatKeys(combo);
    $('#kb-panel-combo').textContent = comboText;

    const actionSelect = $('#kb-action');
    actionSelect.innerHTML = actions.map((a) =>
      `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`
    ).join('');
    actionSelect.value = hk?.action || actions[0]?.id || '';

    $('#kb-name').value = hk?.name || actions.find((a) => a.id === actionSelect.value)?.name || '';
    $('#kb-hint-input').value = hk?.hint || '';
    await validatePanel();
  }

  function closePanel() {
    selectedKey = null;
    editingHotkeyId = null;
    $('#kb-panel-form').classList.add('hidden');
    $('#kb-panel-empty').classList.remove('hidden');
    $('#kb-conflict').classList.add('hidden');
    renderBoard();
  }

  async function validatePanel() {
    if (!selectedKey) return;
    const combo = buildCombo(selectedKey);
    const name = $('#kb-name').value.trim();
    const action = $('#kb-action').value;
    const conflict = await window.api.checkConflict(combo, editingHotkeyId);
    const conflictEl = $('#kb-conflict');
    const saveBtn = $('#kb-save');

    if (conflict) {
      conflictEl.textContent = `⚠ ${conflict.message}`;
      conflictEl.className = `kb-conflict ${conflict.type || 'internal'}`;
      conflictEl.classList.remove('hidden');
    } else {
      conflictEl.classList.add('hidden');
    }

    saveBtn.disabled = !name || !action || !!conflict;
  }

  async function saveAssignment() {
    if (!selectedKey) return;
    const combo = buildCombo(selectedKey);
    const action = $('#kb-action').value;
    const actionMeta = actions.find((a) => a.id === action);
    const comboLabel = await window.api.formatKeys(combo);

    const hotkey = {
      id: editingHotkeyId || undefined,
      name: $('#kb-name').value.trim() || actionMeta?.name || action,
      action,
      keys: combo,
      hint: $('#kb-hint-input').value.trim() || `${comboLabel} — ${actionMeta?.name || action}`,
    };

    config = await window.api.saveHotkey(hotkey);
    const saved = config.hotkeys.find((hk) => combosEqual(hk.keys, combo));
    editingHotkeyId = saved?.id || null;
    renderBoard();
    await validatePanel();
  }

  async function clearAssignment() {
    if (!editingHotkeyId) {
      closePanel();
      return;
    }
    if (!confirm('Снять назначение с этой комбинации?')) return;
    config = await window.api.deleteHotkey(editingHotkeyId);
    closePanel();
  }

  function bindEvents() {
    document.querySelectorAll('.kb-mod').forEach((btn) => {
      btn.addEventListener('click', () => {
        mods[btn.dataset.mod] = !mods[btn.dataset.mod];
        syncModButtons();
        renderBoard();
        if (selectedKey && !MODIFIERS.has(selectedKey)) {
          openPanelForKey(selectedKey);
        }
      });
    });

    $('#kb-action').addEventListener('change', () => {
      if (!$('#kb-name').value.trim()) {
        const a = actions.find((x) => x.id === $('#kb-action').value);
        if (a) $('#kb-name').value = a.name;
      }
      validatePanel();
    });
    $('#kb-name').addEventListener('input', validatePanel);
    $('#kb-hint-input').addEventListener('input', validatePanel);
    $('#kb-save').addEventListener('click', saveAssignment);
    $('#kb-clear').addEventListener('click', clearAssignment);
    $('#kb-cancel').addEventListener('click', closePanel);

    window.api.onConfig((c) => {
      config = c;
      renderBoard();
      if (selectedKey) openPanelForKey(selectedKey);
    });
  }

  async function init() {
    [config, actions] = await Promise.all([
      window.api.getConfig(),
      window.api.getActions(),
    ]);

    const theme = config.theme || 'studio';
    document.documentElement.dataset.theme = theme;

    bindEvents();
    syncModButtons();
    renderBoard();
  }

  init();
})();
