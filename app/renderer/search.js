/**
 * Full-page global search.
 */
(function () {
  let searchIndex = [];
  let selectedResultIdx = 0;
  let visibleResults = [];
  let activeTypeFilter = 'all';

  const PAGE_RESULT_LIMIT = 50;
  const GROUP_ORDER = ['hotkey', 'make', 'template', 'notes', 'action', 'figma', 'settings'];

  const SECTION_LABELS = {
    hotkey: 'Хоткеи',
    make: 'Make it',
    template: 'Templates',
    figma: 'Figma',
    settings: 'Настройки',
    notes: 'Записи',
    action: 'Действия',
  };

  const FILTER_CHIPS = [
    { id: 'all', label: 'Все' },
    { id: 'hotkey', label: 'Хоткеи' },
    { id: 'make', label: 'Make it' },
    { id: 'template', label: 'Templates' },
    { id: 'notes', label: 'Записи' },
    { id: 'action', label: 'Действия' },
    { id: 'settings', label: 'Разделы' },
  ];

  const STATIC_ENTRIES = [
    { id: 'page-hotkeys', type: 'hotkey', title: 'Хоткеи', subtitle: 'Мои команды и сочетания клавиш', keywords: 'hotkeys хоткеи команды', page: 'hotkeys' },
    { id: 'page-makeit', type: 'make', title: 'Make it', subtitle: 'Создать прототип через Figma Make', keywords: 'make ai промпт генерация', page: 'makeit' },
    { id: 'page-templates', type: 'template', title: 'Templates', subtitle: 'Готовые UI-компоненты в Figma', keywords: 'templates шаблоны компоненты ui button card', page: 'templates' },
    { id: 'page-metask', type: 'settings', title: 'Канбан', subtitle: 'Redmine · задачи и доска Kanban', keywords: 'kanban канбан metask задачи redmine rm api ключ', page: 'metask' },
    { id: 'page-agent', type: 'settings', title: 'ИИ Агент', subtitle: 'GigaChat · оценка задач и промпты', keywords: 'ai agent ии агент gigachat gpt задача баннер промпт', page: 'agent' },
    { id: 'page-nanobanana', type: 'settings', title: 'NanoBanana', subtitle: 'Генерация изображений · nananobanana.com', keywords: 'nanobanana nano banana изображение картинка генерация ai art промпт', page: 'nanobanana' },
    { id: 'page-bannermockup', type: 'settings', title: 'Мокап баннеров', subtitle: 'Превью баннеров с NanoBanana', keywords: 'banner mockup баннер мокап превью', page: 'bannermockup' },
    { id: 'page-mail', type: 'settings', title: 'Почта', subtitle: 'Zimbra · веб-почта', keywords: 'mail почта zimbra email письма', page: 'mail' },
    { id: 'page-github', type: 'settings', title: 'GitHub', subtitle: 'Репозитории, PR, code review', keywords: 'github гитхаб git репозиторий pull request pr код review ревью', page: 'github' },
    { id: 'page-outline', type: 'settings', title: 'Outline', subtitle: 'База знаний · документация команды', keywords: 'outline аутлайн документация база знаний wiki вики docs', page: 'outline' },
    { id: 'page-notes', type: 'notes', title: 'Записи', subtitle: 'Заметки и закладки', keywords: 'notes записи заметки закладки bookmarks блокнот', page: 'notes' },
    { id: 'page-figma', type: 'figma', title: 'Подключение Figma', subtitle: 'Плагин, CDP, запуск', keywords: 'figma подключение плагин cdp', page: 'setup' },
    { id: 'page-settings', type: 'settings', title: 'Настройки', subtitle: 'Тема, порты, окно, Make', keywords: 'настройки тема порт config settings', page: 'settings' },
    { id: 'setting-theme', type: 'settings', title: 'Тема оформления', subtitle: 'Dark, Nord, Dracula, Anime…', keywords: 'theme тема dark light anime nord dracula appearance', page: 'settings' },
    { id: 'setting-cdp', type: 'settings', title: 'Порт CDP', subtitle: 'Порт отладки Figma', keywords: 'cdp port 9222 connection', page: 'settings', settingPage: 'setup' },
    { id: 'setting-plugin-port', type: 'settings', title: 'Порт плагина', subtitle: 'WebSocket мост с Figma', keywords: 'plugin port 3847 websocket', page: 'settings', settingPage: 'setup' },
    { id: 'setting-hotkeys', type: 'settings', title: 'Глобальные хоткеи', subtitle: 'Вкл / выкл сервер', keywords: 'toggle сервер hotkeys server', page: 'settings', settingPage: 'hotkeys' },
    { id: 'setting-make', type: 'settings', title: 'Figma Make', subtitle: 'Авто-submit, desktop app', keywords: 'make figma auto submit desktop', page: 'settings', settingPage: 'makeit' },
    { id: 'setting-templates', type: 'settings', title: 'Templates', subtitle: 'Уведомления при копировании', keywords: 'templates toast copy буфер', page: 'settings', settingPage: 'templates' },
    { id: 'setting-window', type: 'settings', title: 'Окно и запуск', subtitle: 'Размер, splash, tray', keywords: 'window splash tray minimized', page: 'settings' },
    { id: 'setting-export', type: 'settings', title: 'Экспорт config', subtitle: 'Сохранить настройки в файл', keywords: 'export import backup config json', page: 'settings' },
  ];

  function filterByRole(entries) {
    const isAllowed = window.RoleNav?.isPageAllowed?.bind(window.RoleNav);
    if (!isAllowed) return entries;
    return entries.filter((entry) => {
      if (entry.page && !isAllowed(entry.page)) return false;
      if (entry.settingPage && !isAllowed(entry.settingPage)) return false;
      return true;
    });
  }

  function getQuickAccessEntries() {
    return filterByRole(STATIC_ENTRIES.filter((e) => e.id.startsWith('page-')));
  }

  const MAKE_EXAMPLES = [
    { title: 'Onboarding', promptKey: 'onboard' },
    { title: 'Dashboard', promptKey: 'dash' },
    { title: 'Landing', promptKey: 'land' },
    { title: 'Modal', promptKey: 'modal' },
  ];

  function resolveMakePrompt(ex) {
    const lib = window.MAKE_STARTER_PROMPTS;
    if (ex.promptKey && lib?.[ex.promptKey]) return lib[ex.promptKey];
    return ex.prompt || '';
  }

  function tokenize(str) {
    return str.toLowerCase().split(/[\s+\-/.,;:]+/).filter(Boolean);
  }

  function fuzzySubsequence(needle, haystack) {
    let i = 0;
    for (const ch of haystack) {
      if (ch === needle[i]) i++;
      if (i === needle.length) return true;
    }
    return false;
  }

  function scoreToken(query, token) {
    if (token === query) return 120;
    if (token.startsWith(query)) return 90;
    if (token.includes(query)) return 70;
    return fuzzySubsequence(query, token) ? 40 : 0;
  }

  function scoreEntry(query, entry) {
    const q = query.trim().toLowerCase();
    if (!q) return 0;

    const corpus = [entry.title, entry.subtitle || '', entry.keywords || '', entry.combo || '', entry.category || ''].join(' ');
    const lower = corpus.toLowerCase();

    if (lower.includes(q)) {
      let s = 100;
      if (entry.title.toLowerCase().startsWith(q)) s += 40;
      return s;
    }

    const qTokens = tokenize(q);
    const hTokens = tokenize(corpus);
    let total = 0;
    for (const qt of qTokens) {
      let best = 0;
      for (const ht of hTokens) best = Math.max(best, scoreToken(qt, ht));
      if (best === 0 && fuzzySubsequence(qt, lower.replace(/\s+/g, ''))) best = 25;
      total += best;
    }
    return total / qTokens.length;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function highlight(text, query) {
    if (!query.trim()) return escapeHtml(text);
    const q = query.trim().toLowerCase();
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx >= 0) {
      return escapeHtml(text.slice(0, idx)) + '<mark>' + escapeHtml(text.slice(idx, idx + q.length)) + '</mark>' + escapeHtml(text.slice(idx + q.length));
    }
    return escapeHtml(text);
  }

  function formatComboShort(keysStr) {
    return keysStr.replace(/LEFT |RIGHT /g, '').split(' ').join('+');
  }

  function iconForType(type) {
    return { hotkey: '⌨', make: '✦', template: '▦', figma: '🎨', settings: '⚙', notes: '📝', action: '⚡' }[type] || '•';
  }

  const PAGE_VISUALS = {
    'page-hotkeys': {
      tone: 'ink',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a2 2 0 012 2v1.07a8.001 8.001 0 015.93 5.93H21a2 2 0 010 4h-1.07A8.001 8.001 0 0114 20.93V22a2 2 0 01-4 0v-1.07A8.001 8.001 0 014.07 15H3a2 2 0 010-4h1.07A8.001 8.001 0 0110 5.07V4a2 2 0 012-2z"/></svg>',
    },
    'page-makeit': {
      tone: 'orange',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z"/><circle cx="18" cy="18" r="2" fill="currentColor" stroke="none"/></svg>',
    },
    'page-templates': {
      tone: 'sky',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    },
    'page-metask': {
      tone: 'mint',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 15h.01M12 15h4"/></svg>',
    },
    'page-agent': {
      tone: 'orange',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>',
    },
    'page-mail': {
      tone: 'violet',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>',
    },
    'page-notes': {
      tone: 'amber',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M8 7h8M8 11h6"/></svg>',
    },
    'page-figma': {
      tone: 'coral',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
    },
    'page-settings': {
      tone: 'slate',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    },
  };

  const TYPE_TONES = {
    hotkey: 'ink',
    make: 'orange',
    template: 'sky',
    figma: 'coral',
    settings: 'slate',
    notes: 'amber',
    action: 'violet',
  };

  function toneForEntry(entry) {
    return PAGE_VISUALS[entry.id]?.tone || TYPE_TONES[entry.type] || 'slate';
  }

  function iconHtmlForEntry(entry) {
    const visual = PAGE_VISUALS[entry.id];
    if (visual) return visual.icon;
    return `<span class="search-icon-emoji">${iconForType(entry.type)}</span>`;
  }

  window.buildSearchIndex = function (config, actions, actionMeta) {
    const items = filterByRole([...STATIC_ENTRIES]);

    if (window.RoleNav?.isPageAllowed?.('templates')) {
      for (const tpl of window.templateSearchEntries || []) {
        items.push(tpl);
      }
    }

    if (window.RoleNav?.isPageAllowed?.('notes')) {
      for (const entry of window.getNotesSearchEntries?.() || []) {
        items.push(entry);
      }
    }

    if (window.RoleNav?.isPageAllowed?.('makeit')) {
      for (const ex of MAKE_EXAMPLES) {
        const prompt = resolveMakePrompt(ex);
        items.push({
          id: 'make-' + ex.title,
          type: 'make',
          title: ex.title,
          subtitle: prompt.slice(0, 55) + '…',
          keywords: prompt,
          page: 'makeit',
          makePrompt: prompt,
        });
      }
    }

    if (window.RoleNav?.isPageAllowed?.('hotkeys')) {
      for (const hk of config.hotkeys || []) {
        const act = actions.find((a) => a.id === hk.action);
        const meta = actionMeta[hk.action] || {};
        items.push({
          id: 'hk-' + hk.id,
          type: 'hotkey',
          title: hk.name,
          subtitle: act?.name || hk.action,
          keywords: [hk.hint, meta.description, meta.whyUseful].filter(Boolean).join(' '),
          combo: hk.keys?.join(' '),
          category: act?.category,
          page: 'hotkeys',
          hotkeyId: hk.id,
        });
      }

      for (const a of actions) {
        const meta = actionMeta[a.id] || {};
        items.push({
          id: 'act-' + a.id,
          type: 'action',
          title: a.name,
          subtitle: a.category,
          keywords: [meta.description, meta.whyUseful].filter(Boolean).join(' '),
          page: 'hotkeys',
          actionId: a.id,
        });
      }
    }

    searchIndex = items;
    renderCurrentView();
  };

  function searchAll(query, limit) {
    const max = limit ?? PAGE_RESULT_LIMIT;
    const q = query.trim();
    if (!q) return [];
    return searchIndex
      .map((entry) => ({ entry, score: scoreEntry(q, entry) }))
      .filter((r) => r.score > 20)
      .filter((r) => activeTypeFilter === 'all' || r.entry.type === activeTypeFilter)
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((r) => r.entry);
  }

  function getInput() {
    return document.getElementById('search-input');
  }

  function navigateToPage(pageId) {
    if (window.RoleNav?.navigateToPage?.(pageId)) return;
    if (pageId !== 'metask') window.detachMetaskBoard?.();
    if (pageId !== 'mail') window.detachMailView?.();
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === pageId));
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    document.getElementById('page-' + pageId)?.classList.add('active');
    if (pageId === 'hotkeys' && window.backToHotkeys) window.backToHotkeys();
    if (pageId === 'metask') window.activateMetaskPage?.();
    if (pageId === 'agent') window.activateAgentPage?.();
    if (pageId === 'mail') window.activateMailPage?.();
    if (pageId === 'github' || pageId === 'outline') window.activateWebtab?.(pageId);
    if (pageId === 'notes') window.activateNotesPage?.();
  }

  function applyResult(entry) {
    const input = getInput();
    if (input) input.value = '';
    document.getElementById('search-clear')?.classList.add('hidden');

    navigateToPage(entry.page);

    if (entry.noteId || entry.bookmarkId) {
      setTimeout(() => window.openNotesEntry?.(entry), 50);
    } else if (entry.hotkeyId && window.openHotkeyDetail) {
      setTimeout(() => window.openHotkeyDetail(entry.hotkeyId), 50);
    } else if (entry.makePrompt) {
      const ta = document.getElementById('make-prompt');
      if (ta) {
        ta.value = entry.makePrompt;
        ta.dispatchEvent(new Event('input'));
        ta.focus();
      }
    } else if (entry.templateId && window.api?.copyTemplate) {
      setTimeout(async () => {
        try {
          const result = await window.api.copyTemplate(entry.templateId);
          if (result?.ok && window.reloadTemplates) {
            const msg = result.mode === 'plugin'
              ? '«' + (result.name || entry.title) + '» вставлен'
              : '«' + (result.name || entry.title) + '» скопирован';
            const toast = document.getElementById('tpl-toast');
            if (toast) {
              toast.textContent = msg;
              toast.className = 'tpl-toast tpl-toast-success tpl-toast-show';
              setTimeout(() => toast.classList.remove('tpl-toast-show'), 2800);
            }
          }
        } catch { /* ignore */ }
      }, 120);
    } else if (entry.page === 'settings') {
      setTimeout(() => {
        const focusMap = {
          'setting-cdp': 'set-cdp-port',
          'setting-plugin-port': 'set-plugin-port',
          'setting-export': 'btn-export-config',
        };
        document.getElementById(focusMap[entry.id] || '')?.focus();
      }, 80);
    }
  }

  function buildResultsHtml(results, query) {
    const groups = {};
    for (const r of results) {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    }

    let html = '';
    for (const type of GROUP_ORDER) {
      if (!groups[type]?.length) continue;
      html += `<div class="search-group"><div class="search-group-label">${SECTION_LABELS[type]}</div>`;
      for (const entry of groups[type]) {
        const idx = results.indexOf(entry);
        html += `<button type="button" class="search-result${idx === 0 ? ' selected' : ''}" data-idx="${idx}">
          <span class="search-result-icon search-result-icon--${toneForEntry(entry)}">${iconHtmlForEntry(entry)}</span>
          <span class="search-result-body">
            <span class="search-result-title">${highlight(entry.title, query)}</span>
            <span class="search-result-sub">${highlight(entry.subtitle || '', query)}</span>
          </span>
          ${entry.combo ? `<span class="search-result-badge">${escapeHtml(formatComboShort(entry.combo))}</span>` : ''}
        </button>`;
      }
      html += '</div>';
    }
    return html;
  }

  function bindResultClicks(container) {
    container?.querySelectorAll('.search-result').forEach((btn) => {
      btn.addEventListener('click', () => {
        const entry = visibleResults[Number(btn.dataset.idx)];
        if (entry) applyResult(entry);
      });
    });
  }

  function syncSearchPageLayout(query) {
    const page = document.getElementById('page-search');
    if (!page) return;
    page.classList.toggle('search-has-query', !!String(query || '').trim());
  }

  function renderQuickAccess() {
    const hint = document.getElementById('search-hint');
    const results = document.getElementById('search-results');
    const empty = document.getElementById('search-empty');
    const meta = document.getElementById('search-meta');
    if (!hint || !results) return;

    visibleResults = [];
    selectedResultIdx = 0;
    empty?.classList.add('hidden');
    if (meta) meta.innerHTML = '';

    hint.classList.remove('hidden');
    const quickEntries = getQuickAccessEntries();
    hint.innerHTML = `
      <div class="search-page-hint-head">
        <span class="search-page-hint-title">Быстрый доступ</span>
        <span class="search-page-hint-sub">Разделы приложения</span>
      </div>
      <div class="search-quick-grid">
        ${quickEntries.map((entry, index) => {
          const tone = toneForEntry(entry);
          return `
          <button type="button" class="search-quick-card search-quick-card--${tone}" data-quick-id="${entry.id}" style="--qi:${index}">
            <span class="search-quick-icon search-quick-icon--${tone}">${iconHtmlForEntry(entry)}</span>
            <span class="search-quick-body">
              <span class="search-quick-title">${escapeHtml(entry.title)}</span>
              <span class="search-quick-sub">${escapeHtml(entry.subtitle || '')}</span>
            </span>
            <span class="search-quick-go" aria-hidden="true">→</span>
          </button>`;
        }).join('')}
      </div>`;

    hint.querySelectorAll('[data-quick-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const entry = quickEntries.find((e) => e.id === btn.dataset.quickId);
        if (entry) applyResult(entry);
      });
    });

    results.innerHTML = '';
    syncSearchPageLayout('');
  }

  function renderPageResults(query) {
    const hint = document.getElementById('search-hint');
    const container = document.getElementById('search-results');
    const empty = document.getElementById('search-empty');
    const meta = document.getElementById('search-meta');
    if (!container) return;

    const q = query.trim();
    syncSearchPageLayout(q);
    if (!q) {
      renderQuickAccess();
      return;
    }

    hint?.classList.add('hidden');
    const results = searchAll(q);
    visibleResults = results;
    selectedResultIdx = 0;

    if (meta) {
      meta.innerHTML = results.length
        ? `<span class="search-meta-pill">${results.length} результат${results.length === 1 ? '' : results.length < 5 ? 'а' : 'ов'}</span>`
        : '';
    }

    if (!results.length) {
      container.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');
    container.innerHTML = buildResultsHtml(results, q);
    bindResultClicks(container);
  }

  function renderCurrentView() {
    renderPageResults(getInput()?.value || '');
  }

  function updateSelection() {
    document.querySelectorAll('#search-results .search-result').forEach((el, i) => {
      el.classList.toggle('selected', i === selectedResultIdx);
    });
    document.querySelector('#search-results .search-result.selected')?.scrollIntoView({ block: 'nearest' });
  }

  function renderFilterChips() {
    const wrap = document.getElementById('search-filters');
    if (!wrap) return;
    wrap.innerHTML = FILTER_CHIPS.map(
      (chip) => `<button type="button" class="search-filter-chip${chip.id === activeTypeFilter ? ' active' : ''}" data-filter="${chip.id}">${chip.label}</button>`
    ).join('');
    wrap.querySelectorAll('.search-filter-chip').forEach((btn) => {
      btn.onclick = () => {
        activeTypeFilter = btn.dataset.filter;
        renderFilterChips();
        renderCurrentView();
        getInput()?.focus();
      };
    });
  }

  window.openSearchPage = function openSearchPage() {
    navigateToPage('search');
    window.activateSearchPage?.();
  };

  window.activateSearchPage = function activateSearchPage() {
    const input = getInput();
    if (!input) return;
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    renderCurrentView();
  };

  window.initGlobalSearch = function (getData) {
    const input = getInput();
    const clearBtn = document.getElementById('search-clear');
    const wrap = document.querySelector('.search-page-input-wrap');
    if (!input) return;

    function rebuild() {
      const data = getData();
      if (data) window.buildSearchIndex(data.config, data.actions, data.actionMeta);
    }

    rebuild();
    window.rebuildSearchIndex = rebuild;
    renderFilterChips();
    renderQuickAccess();

    window.addEventListener('role-changed', () => {
      rebuild();
      renderFilterChips();
      renderQuickAccess();
    });

    function syncSearchInput() {
      const hasVal = !!input.value.trim();
      clearBtn?.classList.toggle('hidden', !hasVal);
      wrap?.classList.toggle('has-value', hasVal);
    }

    input.addEventListener('input', () => {
      syncSearchInput();
      renderPageResults(input.value);
    });

    input.addEventListener('focus', () => wrap?.classList.add('is-focused'));
    input.addEventListener('blur', () => wrap?.classList.remove('is-focused'));

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      syncSearchInput();
      renderQuickAccess();
      input.focus();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        syncSearchInput();
        renderQuickAccess();
        return;
      }
      if (!visibleResults.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedResultIdx = Math.min(selectedResultIdx + 1, visibleResults.length - 1);
        updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedResultIdx = Math.max(selectedResultIdx - 1, 0);
        updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (visibleResults[selectedResultIdx]) applyResult(visibleResults[selectedResultIdx]);
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        window.openSearchPage();
      }
    });
  };
})();
