(function initAgentSidePanel() {
  const $ = (id) => document.getElementById(id);

  let sideTab = 'calendar';
  let notes = [];
  let events = [];
  let selectedNoteId = null;
  let noteSaveTimer = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatWhen(iso, allDay) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const date = d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
      if (allDay) return date;
      return `${date}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '';
    }
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return (tmp.textContent || '').trim();
  }

  function setSideTab(next) {
    sideTab = next === 'notes' ? 'notes' : 'calendar';
    document.querySelectorAll('[data-agent-side-tab]').forEach((btn) => {
      const active = btn.getAttribute('data-agent-side-tab') === sideTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $('agent-side-calendar')?.classList.toggle('hidden', sideTab !== 'calendar');
    $('agent-side-notes')?.classList.toggle('hidden', sideTab !== 'notes');
  }

  function renderCalendar() {
    const list = $('agent-calendar-list');
    if (!list) return;
    const upcoming = events
      .filter((e) => new Date(e.startAt).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
      .slice(0, 24);
    if (!upcoming.length) {
      list.innerHTML = '<p class="agent-side-empty">Нет записей. Попросите Konstancia: «запиши в календарь завтра созвон в 15:00».</p>';
      return;
    }
    list.innerHTML = upcoming.map((event) => (
      `<article class="agent-calendar-item" data-cal-id="${escapeHtml(event.id)}">`
      + `<div class="agent-calendar-item-when">${escapeHtml(formatWhen(event.startAt, event.allDay))}</div>`
      + `<div class="agent-calendar-item-title">${escapeHtml(event.title)}</div>`
      + `${event.body ? `<p class="agent-calendar-item-body">${escapeHtml(event.body.slice(0, 120))}</p>` : ''}`
      + `<button type="button" class="agent-calendar-item-del" data-cal-delete="${escapeHtml(event.id)}" title="Удалить">×</button>`
      + '</article>'
    )).join('');
  }

  function renderNotesList() {
    const list = $('agent-side-notes-list');
    if (!list) return;
    if (!notes.length) {
      list.innerHTML = '<p class="agent-side-empty">Нет записей</p>';
      return;
    }
    list.innerHTML = notes.slice(0, 40).map((note) => {
      const active = note.id === selectedNoteId ? ' is-active' : '';
      const preview = stripHtml(note.contentHtml).slice(0, 80);
      return (
        `<button type="button" class="agent-side-note-item${active}" data-note-id="${escapeHtml(note.id)}">`
        + `<span class="agent-side-note-title">${escapeHtml(note.title || 'Без названия')}</span>`
        + `<span class="agent-side-note-preview">${escapeHtml(preview || '—')}</span>`
        + '</button>'
      );
    }).join('');
  }

  function renderNoteEditor() {
    const editor = $('agent-side-note-editor');
    const note = notes.find((n) => n.id === selectedNoteId);
    if (!editor) return;
    if (!note) {
      editor.classList.add('hidden');
      return;
    }
    editor.classList.remove('hidden');
    const title = $('agent-side-note-title-input');
    const content = $('agent-side-note-content');
    if (title && title !== document.activeElement) title.value = note.title || '';
    if (content && content !== document.activeElement) content.value = stripHtml(note.contentHtml);
  }

  async function loadCalendar() {
    const result = await window.api.agentCalendarList?.({});
    events = result?.events || [];
    renderCalendar();
  }

  async function loadNotes() {
    const library = await window.api.getNotesLibrary?.();
    notes = library?.notes || [];
    if (selectedNoteId && !notes.some((n) => n.id === selectedNoteId)) selectedNoteId = null;
    renderNotesList();
    renderNoteEditor();
  }

  function scheduleNoteSave() {
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(saveSelectedNote, 450);
  }

  async function saveSelectedNote() {
    const note = notes.find((n) => n.id === selectedNoteId);
    if (!note) return;
    const title = $('agent-side-note-title-input')?.value || '';
    const text = $('agent-side-note-content')?.value || '';
    const contentHtml = text ? `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>` : '';
    await window.api.saveNote?.({ ...note, title, contentHtml });
    await loadNotes();
  }

  async function createNote() {
    const created = await window.api.saveNote?.({ title: 'Новая запись', contentHtml: '' });
    if (created?.id) {
      selectedNoteId = created.id;
      setSideTab('notes');
      await loadNotes();
      $('agent-side-note-title-input')?.focus();
    }
  }

  function bindEvents() {
    document.querySelectorAll('[data-agent-side-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setSideTab(btn.getAttribute('data-agent-side-tab')));
    });

    $('agent-calendar-add')?.addEventListener('click', async () => {
      const title = window.prompt('Название записи', 'Созвон');
      if (!title) return;
      const start = new Date();
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      await window.api.agentCalendarUpsert?.({
        title,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
        source: 'manual',
      });
      await loadCalendar();
    });

    $('agent-calendar-list')?.addEventListener('click', async (event) => {
      const del = event.target.closest('[data-cal-delete]');
      if (!del) return;
      const id = del.getAttribute('data-cal-delete');
      if (!id || !window.confirm('Удалить запись из календаря?')) return;
      await window.api.agentCalendarDelete?.({ id });
      await loadCalendar();
    });

    $('agent-side-note-add')?.addEventListener('click', () => { void createNote(); });

    $('agent-side-notes-list')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-note-id]');
      if (!btn) return;
      selectedNoteId = btn.getAttribute('data-note-id');
      renderNotesList();
      renderNoteEditor();
    });

    $('agent-side-note-title-input')?.addEventListener('input', scheduleNoteSave);
    $('agent-side-note-content')?.addEventListener('input', scheduleNoteSave);

    window.api.onNotesUpdated?.(() => { void loadNotes(); });
    window.api.onAgentCalendarUpdated?.(() => { void loadCalendar(); });
  }

  window.refreshAgentSidePanel = async function refreshAgentSidePanel() {
    await Promise.all([loadCalendar(), loadNotes()]);
  };

  window.openAgentNotesEntry = function openAgentNotesEntry(id, kind = 'note') {
    selectedNoteId = String(id || '').trim() || null;
    setSideTab('notes');
    void loadNotes().then(() => {
      renderNotesList();
      renderNoteEditor();
    });
  };

  window.activateAgentPage = ((prev) => async function wrappedActivateAgentPage(...args) {
    if (typeof prev === 'function') await prev(...args);
    setSideTab(sideTab);
    await window.refreshAgentSidePanel?.();
  })(window.activateAgentPage);

  bindEvents();
  setSideTab('calendar');
})();
