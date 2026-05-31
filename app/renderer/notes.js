(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let library = { bookmarks: [], notes: [] };
  let mode = 'notes';
  let selectedId = null;
  let saveTimer = null;
  let dirty = false;

  const TEXT_COLORS = [
    { label: 'Обычный', value: '' },
    { label: 'Акцент', value: 'var(--accent, #6bffd4)' },
    { label: 'Красный', value: '#ff6b8a' },
    { label: 'Жёлтый', value: '#ffd86b' },
    { label: 'Голубой', value: '#6bb8ff' },
  ];

  function formatDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function parseTags(str) {
    return String(str || '')
      .split(/[,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return (tmp.textContent || '').trim();
  }

  function setSaveHint(text, saved) {
    const el = $('#notes-save-hint');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('saved', !!saved);
  }

  async function loadLibrary() {
    library = (await window.api.getNotesLibrary()) || { bookmarks: [], notes: [] };
    window.rebuildSearchIndex?.();
    renderList();
    if (selectedId) {
      const exists =
        mode === 'notes'
          ? library.notes.some((n) => n.id === selectedId)
          : library.bookmarks.some((b) => b.id === selectedId);
      if (!exists) selectedId = null;
    }
    renderEditor();
  }

  function filteredItems() {
    const q = ($('#notes-filter')?.value || '').trim().toLowerCase();
    const items = mode === 'notes' ? library.notes : library.bookmarks;
    if (!q) return items;
    return items.filter((item) => {
      const hay = [item.title, item.url, item.tags?.join(' '), stripHtml(item.contentHtml)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderList() {
    const list = $('#notes-list');
    const countEl = $('#notes-list-count');
    if (!list) return;

    const items = filteredItems();
    if (countEl) countEl.textContent = String(items.length);

    if (!items.length) {
      list.innerHTML = `<div class="notes-list-empty">${mode === 'notes' ? 'Нет заметок' : 'Нет закладок'}</div>`;
      return;
    }

    list.innerHTML = items
      .map((item) => {
        const active = item.id === selectedId ? ' active' : '';
        const pin = item.pinned ? '<span class="notes-list-item-pin">📌</span>' : '';
        const meta =
          mode === 'notes'
            ? formatDate(item.updatedAt)
            : item.url || '—';
        return `<button type="button" class="notes-list-item${active}" data-id="${item.id}">
          <span class="notes-list-item-title">${pin}${escapeHtml(item.title || 'Без названия')}</span>
          <span class="notes-list-item-meta">${escapeHtml(meta)}</span>
        </button>`;
      })
      .join('');

    list.querySelectorAll('.notes-list-item').forEach((btn) => {
      btn.onclick = () => {
        if (dirty) flushSave();
        selectedId = btn.dataset.id;
        renderList();
        renderEditor();
      };
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function currentItem() {
    if (!selectedId) return null;
    const arr = mode === 'notes' ? library.notes : library.bookmarks;
    return arr.find((x) => x.id === selectedId) || null;
  }

  function renderEditor() {
    const empty = $('#notes-empty-state');
    const editor = $('#notes-editor');
    const bookmarkPanel = $('#notes-bookmark-panel');
    const richToolbar = $('#notes-richtoolbar');
    const content = $('#notes-content');
    const item = currentItem();

    if (!item) {
      empty?.classList.remove('hidden');
      editor?.classList.remove('visible');
      setSaveHint('');
      return;
    }

    empty?.classList.add('hidden');
    editor?.classList.add('visible');

    const titleEl = $('#notes-editor-title');
    const tagsEl = $('#notes-editor-tags');
    if (titleEl) titleEl.value = item.title || '';
    if (tagsEl) tagsEl.value = (item.tags || []).join(', ');

    const isNotes = mode === 'notes';
    bookmarkPanel?.classList.toggle('hidden', isNotes);
    richToolbar?.classList.toggle('hidden', !isNotes);
    content?.classList.toggle('hidden', !isNotes);

    if (isNotes && content) {
      if (document.activeElement !== content) {
        content.innerHTML = item.contentHtml || '';
      }
    } else {
      const urlEl = $('#notes-bookmark-url');
      if (urlEl) urlEl.value = item.url || '';
    }

    $('#notes-pin-btn')?.classList.toggle('active', !!item.pinned);
    $('#notes-pin-btn')?.classList.toggle('hidden', !isNotes);
    $('#notes-open-url')?.classList.toggle('hidden', isNotes);
    setSaveHint(formatDate(item.updatedAt) ? `Изменено ${formatDate(item.updatedAt)}` : '');
    dirty = false;
  }

  function scheduleSave() {
    dirty = true;
    setSaveHint('Сохранение…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 700);
  }

  async function flushSave() {
    clearTimeout(saveTimer);
    if (!selectedId) return;

    const title = $('#notes-editor-title')?.value || '';
    const tags = parseTags($('#notes-editor-tags')?.value);

    if (mode === 'notes') {
      const contentHtml = $('#notes-content')?.innerHTML || '';
      const pinned = $('#notes-pin-btn')?.classList.contains('active');
      const item = await window.api.saveNote({
        id: selectedId,
        title,
        contentHtml,
        tags,
        pinned,
        createdAt: currentItem()?.createdAt,
      });
      mergeItem('notes', item);
    } else {
      const url = $('#notes-bookmark-url')?.value || '';
      const item = await window.api.saveBookmark({
        id: selectedId,
        title,
        url,
        tags,
        createdAt: currentItem()?.createdAt,
      });
      mergeItem('bookmarks', item);
    }

    dirty = false;
    setSaveHint('Сохранено', true);
    renderList();
  }

  function mergeItem(key, item) {
    if (!item?.id) return;
    const arr = library[key];
    const idx = arr.findIndex((x) => x.id === item.id);
    if (idx >= 0) arr[idx] = item;
    else arr.unshift(item);
  }

  async function createItem() {
    if (dirty) await flushSave();

    if (mode === 'notes') {
      const item = await window.api.saveNote({
        title: 'Новая заметка',
        contentHtml: '',
        tags: [],
        pinned: false,
      });
      mergeItem('notes', item);
      selectedId = item.id;
    } else {
      const item = await window.api.saveBookmark({
        title: 'Новая закладка',
        url: '',
        tags: [],
      });
      mergeItem('bookmarks', item);
      selectedId = item.id;
    }

    renderList();
    renderEditor();
    $('#notes-editor-title')?.focus();
    $('#notes-editor-title')?.select();
  }

  async function deleteCurrent() {
    const item = currentItem();
    if (!item) return;
    const label = mode === 'notes' ? 'заметку' : 'закладку';
    if (!confirm(`Удалить ${label} «${item.title || 'Без названия'}»?`)) return;

    if (mode === 'notes') await window.api.deleteNote(item.id);
    else await window.api.deleteBookmark(item.id);

    library[mode === 'notes' ? 'notes' : 'bookmarks'] = library[mode === 'notes' ? 'notes' : 'bookmarks'].filter(
      (x) => x.id !== item.id
    );
    selectedId = null;
    renderList();
    renderEditor();
  }

  function execCmd(cmd, value) {
    const content = $('#notes-content');
    if (!content) return;
    content.focus();
    document.execCommand(cmd, false, value ?? null);
    scheduleSave();
  }

  function bindRichToolbar() {
    $('#notes-richtoolbar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cmd]');
      if (!btn) return;
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      if (cmd === 'createLink') {
        const url = prompt('URL ссылки:', 'https://');
        if (url) execCmd('createLink', url);
        return;
      }
      if (cmd === 'formatBlock') {
        execCmd('formatBlock', btn.dataset.value);
        return;
      }
      execCmd(cmd);
    });

    $('#notes-color-swatches')?.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-color]');
      if (!sw) return;
      if (!sw.dataset.color) execCmd('removeFormat');
      else execCmd('foreColor', sw.dataset.color);
      $$('.notes-color-swatch').forEach((s) => s.classList.remove('active'));
      sw.classList.add('active');
    });
  }

  function setMode(next) {
    if (mode === next) return;
    if (dirty) flushSave();
    mode = next;
    selectedId = null;
    $$('.notes-mode-tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    $('#notes-list-label').textContent = mode === 'notes' ? 'Заметки' : 'Закладки';
    $('#notes-add-btn').textContent = mode === 'notes' ? '+ Заметка' : '+ Закладка';
    renderList();
    renderEditor();
  }

  function bindEvents() {
    $$('.notes-mode-tab').forEach((tab) => {
      tab.onclick = () => setMode(tab.dataset.mode);
    });

    $('#notes-add-btn')?.addEventListener('click', createItem);
    $('#notes-delete-btn')?.addEventListener('click', deleteCurrent);
    $('#notes-filter')?.addEventListener('input', renderList);

    $('#notes-editor-title')?.addEventListener('input', scheduleSave);
    $('#notes-editor-tags')?.addEventListener('input', scheduleSave);
    $('#notes-bookmark-url')?.addEventListener('input', scheduleSave);

    $('#notes-content')?.addEventListener('input', scheduleSave);
    $('#notes-content')?.addEventListener('blur', () => {
      if (dirty) flushSave();
    });

    $('#notes-pin-btn')?.addEventListener('click', () => {
      $('#notes-pin-btn')?.classList.toggle('active');
      scheduleSave();
    });

    $('#notes-open-url')?.addEventListener('click', () => {
      const url = $('#notes-bookmark-url')?.value?.trim();
      if (url) window.api.notesOpenUrl(url);
    });

    bindRichToolbar();

    window.api.onNotesUpdated?.((data) => {
      library = data || library;
      renderList();
      if (selectedId) renderEditor();
    });
  }

  function buildColorSwatches() {
    const wrap = $('#notes-color-swatches');
    if (!wrap) return;
    wrap.innerHTML = TEXT_COLORS.map(
      (c, i) =>
        `<button type="button" class="notes-color-swatch${i === 0 ? ' active' : ''}" data-color="${escapeHtml(c.value)}" title="${escapeHtml(c.label)}" style="background:${c.value || 'var(--text)'}"></button>`
    ).join('');
  }

  function initNotes() {
    buildColorSwatches();
    bindEvents();
    loadLibrary();
  }

  window.activateNotesPage = function activateNotesPage() {
    loadLibrary();
  };

  window.openNotesEntry = function openNotesEntry(entry) {
    if (dirty) flushSave();
    mode = entry.noteId ? 'notes' : 'bookmarks';
    selectedId = entry.noteId || entry.bookmarkId;
    $$('.notes-mode-tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    $('#notes-list-label').textContent = mode === 'notes' ? 'Заметки' : 'Закладки';
    $('#notes-add-btn').textContent = mode === 'notes' ? '+ Заметка' : '+ Закладка';
    renderList();
    renderEditor();
  };

  window.initNotes = initNotes;
  window.getNotesSearchEntries = function getNotesSearchEntries() {
    const entries = [];
    for (const n of library.notes || []) {
      entries.push({
        id: `note-${n.id}`,
        type: 'notes',
        title: n.title || 'Заметка',
        subtitle: stripHtml(n.contentHtml).slice(0, 80) || 'Заметка',
        keywords: `заметки notes ${(n.tags || []).join(' ')}`,
        page: 'notes',
        noteId: n.id,
      });
    }
    for (const b of library.bookmarks || []) {
      entries.push({
        id: `bm-${b.id}`,
        type: 'notes',
        title: b.title || 'Закладка',
        subtitle: b.url || 'Закладка',
        keywords: `закладки bookmarks ${(b.tags || []).join(' ')}`,
        page: 'notes',
        bookmarkId: b.id,
      });
    }
    return entries;
  };
})();
