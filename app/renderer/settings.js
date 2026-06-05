(function () {
  let config = null;

  function $(id) {
    return document.getElementById(id);
  }

  function s(path) {
    return path.split('.').reduce((o, k) => o?.[k], config.settings);
  }

  window.applyAppSettings = function applyAppSettings(settings) {
    if (!settings) return;
    const root = document.documentElement;
    root.dataset.fontSize = settings.appearance?.fontSize || 'medium';
    root.toggleAttribute('data-compact', !!settings.appearance?.compactLayout);
    root.toggleAttribute('data-no-anim', settings.appearance?.animationsEnabled === false);
    document.querySelector('.player-bar')?.classList.toggle('hidden', settings.appearance?.showPlayerBar === false);
    document.getElementById('make-suggestions')?.classList.toggle('hidden', settings.make?.showSuggestions === false);
    window.appSettings = settings;
    window.dispatchEvent(new CustomEvent('app-settings-updated', { detail: settings }));
  };

  async function patch(path, value) {
    const parts = path.split('.');
    const section = parts[0];
    const key = parts[1];
    const updates = { [section]: { [key]: value } };
    config = await window.api.updateAppSettings(updates);
    applyAppSettings(config.settings);
    if (path === 'connection.cdpPort') {
      config.figmaCdpPort = value;
    }
    if (path === 'connection.pluginPort') {
      config.port = value;
    }
    return config;
  }

  function bindToggle(id, path) {
    const el = $(id);
    if (!el) return;
    el.checked = !!s(path);
    el.onchange = () => patch(path, el.checked);
  }

  function bindNumber(id, path, onSave) {
    const el = $(id);
    const btn = $(id + '-save');
    if (!el) return;
    el.value = s(path) ?? '';
    const save = async () => {
      const val = Number(el.value);
      if (Number.isNaN(val)) return;
      await patch(path, val);
      onSave?.(val);
    };
    if (btn) btn.onclick = save;
    else el.onchange = save;
  }

  function bindSelect(id, path) {
    const el = $(id);
    if (!el) return;
    el.value = s(path) || el.options[0]?.value;
    el.onchange = () => patch(path, el.value);
  }

  const SPEECH_LANG_LABELS = {
    'ru-RU': 'Русский',
    'en-US': 'English (US)',
    'uk-UA': 'Українська',
    'de-DE': 'Deutsch',
  };

  async function refreshSpeechLangSelect() {
    const select = $('set-speech-lang');
    const hint = $('set-speech-lang-hint');
    if (!select) return;

    const current = s('make.speechLanguage') || 'ru-RU';
    let installed = [];
    try {
      if (await window.api.speechSupported?.()) {
        installed = await window.api.speechListLanguages?.() || [];
      }
    } catch {
      installed = [];
    }

    const allOptions = Array.from(select.options).map((option) => ({
      value: option.value,
      label: SPEECH_LANG_LABELS[option.value] || option.textContent.trim(),
    }));

    select.innerHTML = allOptions.map(({ value, label }) => {
      const ready = installed.length === 0 || installed.includes(value);
      const suffix = ready ? '' : ' (не установлен в Windows)';
      return `<option value="${value}"${ready ? '' : ' data-missing="1"'}>${label}${suffix}</option>`;
    }).join('');

    select.value = current;
    if (!select.value && select.options.length) {
      select.selectedIndex = 0;
    }

    if (!hint) return;

    if (!installed.length) {
      hint.textContent = 'Windows Speech — не удалось проверить установленные языки';
      return;
    }

    if (installed.includes(current)) {
      hint.textContent = `Windows Speech — установлено: ${installed.join(', ')}`;
      return;
    }

    hint.textContent = (
      `Язык «${SPEECH_LANG_LABELS[current] || current}» не установлен в Windows. `
      + `Доступно: ${installed.join(', ')}. `
      + 'Параметры → Время и язык → Речь → добавьте «Распознавание речи» для нужного языка.'
    );
  }

  function bindSegmented(containerId, path, values) {
    const container = $(containerId);
    if (!container) return;
    const current = s(path);
    container.querySelectorAll('.settings-seg').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === current);
      btn.onclick = async () => {
        container.querySelectorAll('.settings-seg').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        await patch(path, btn.dataset.value);
      };
    });
  }

  function syncThemePicker(theme) {
    document.querySelectorAll('.theme-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  function themeCoverHtml(t) {
    const swatchClass = t.swatch === 'custom' ? 'theme-cover-custom' : `theme-cover-${t.swatch}`;
    const style = t.swatch === 'custom' && t.accent ? ` style="--tc-accent:${t.accent}"` : '';
    return `
      <span class="theme-cover ${swatchClass}"${style}>
        <span class="theme-cover-frame">
          <span class="theme-cover-sidebar">
            <span class="theme-cover-dot theme-cover-dot--brand"></span>
            <span class="theme-cover-nav theme-cover-nav--active"></span>
            <span class="theme-cover-nav"></span>
            <span class="theme-cover-nav"></span>
          </span>
          <span class="theme-cover-body">
            <span class="theme-cover-card">
              <span class="theme-cover-line"></span>
              <span class="theme-cover-line theme-cover-line--sm"></span>
            </span>
            <span class="theme-cover-pill"></span>
          </span>
        </span>
        <span class="theme-cover-check" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
        </span>
      </span>`;
  }

  function renderThemePicker(cfg = config) {
    const grid = $('theme-picker');
    if (!grid || !window.APP_THEMES) return;
    const items = window.customThemeEngine?.getThemePickerItems(cfg || config) || window.APP_THEMES;
    grid.innerHTML = items.map((t) => `
      <button type="button" class="theme-card" data-theme="${t.id}" title="${t.label}">
        ${themeCoverHtml(t)}
        <span class="theme-card-label">${t.label}</span>
      </button>
    `).join('');
    syncThemePicker(cfg?.theme || config?.theme || 'light');
    bindThemeCards();
  }

  window.renderThemePicker = renderThemePicker;

  function bindThemeCards() {
    document.querySelectorAll('.theme-card').forEach((btn) => {
      btn.onclick = async () => {
        const theme = btn.dataset.theme;
        syncThemePicker(theme);
        if (window.applyTheme) window.applyTheme(theme);
        config = await window.api.setTheme(theme);
      };
    });
  }

  function bindTheme() {
    renderThemePicker();
  }

  function bindServerToggle() {
    const el = $('toggle-server');
    if (!el) return;
    el.checked = s('hotkeys.serverEnabled') !== false;
    el.onchange = async () => {
      await window.api.toggleServer(el.checked);
      await patch('hotkeys.serverEnabled', el.checked);
    };
  }

  function bindUpdaterSettings() {
    const status = $('set-updater-status');
    const checkBtn = $('set-updater-check');
    const installBtn = $('set-updater-install');

    function setStatus(payload = {}) {
      if (!status) return;
      const state = payload.state;
      if (state === 'checking') status.textContent = 'Проверяем обновления...';
      else if (state === 'available') status.textContent = `Доступно обновление ${payload.info?.version || ''}`.trim();
      else if (state === 'downloading') status.textContent = `Скачиваем обновление: ${Math.round(payload.progress?.percent || 0)}%`;
      else if (state === 'downloaded') {
        status.textContent = (
          payload.message
          || `Обновление ${payload.info?.version || ''} скачано. Оно установится автоматически после закрытия приложения.`
        ).trim();
        installBtn?.classList.remove('hidden');
      } else if (state === 'not-available') status.textContent = 'Установлена актуальная версия.';
      else if (state === 'disabled') status.textContent = payload.message || 'Обновления доступны только в установленной сборке.';
      else if (state === 'error') status.textContent = `Ошибка обновления: ${payload.message || 'неизвестно'}`;
    }

    checkBtn?.addEventListener('click', async () => {
      const result = await window.api.updaterCheckNow?.();
      setStatus(result);
    });
    installBtn?.addEventListener('click', () => window.api.updaterInstallNow?.());
    window.api.onUpdaterStatus?.(setStatus);
  }

  function bindKanbanSettings() {
    const url = $('set-kanban-url');
    const boardPath = $('set-kanban-board-path');
    const apiKey = $('set-kanban-api-key');
    const username = $('set-kanban-username');
    const password = $('set-kanban-password');
    const saveBtn = $('set-kanban-save');

    function fillFromConfig() {
      const m = s('metask') || {};
      if (url) url.value = m.baseUrl || '';
      if (boardPath) boardPath.value = m.boardPath || '/kanban/board';
      if (apiKey && m.apiKey) apiKey.value = m.apiKey;
      if (username && m.username) username.value = m.username;
      if (password && m.password) password.value = m.password;
    }

    fillFromConfig();

    saveBtn?.addEventListener('click', async () => {
      const creds = {
        baseUrl: url?.value?.trim() || '',
        boardPath: boardPath?.value?.trim() || '/kanban/board',
        apiKey: apiKey?.value?.trim() || '',
        username: username?.value?.trim() || '',
        password: password?.value || '',
      };
      if (!creds.baseUrl || !creds.apiKey) {
        alert('Укажите URL Redmine и API-ключ');
        return;
      }
      const saved = await window.api.metaskSaveCredentials(creds);
      config = await window.api.getConfig();
      window.applyKanbanCredentialsToForm?.(saved || creds);
      fillFromConfig();
      saveBtn.textContent = 'Сохранено';
      setTimeout(() => { saveBtn.textContent = 'Сохранить подключение'; }, 1800);
    });

    bindToggle('set-kanban-notify', 'metask.notifyOnUpdate');
    bindNumber('set-kanban-poll', 'metask.pollIntervalMinutes');
  }

  async function refreshTaskLearningStats() {
    const el = $('set-task-learning-stats');
    if (!el?.parentElement) return;
    try {
      const res = await window.api.taskKnowledgeStats?.();
      const st = res?.stats;
      if (st) {
        el.textContent = `${st.chunks} фрагм. · ${st.issuesIndexed} задач · ${st.attachmentsIndexed || 0} вложений · ${st.playbooks} playbook`;
      }
    } catch {
      el.textContent = 'Локальная память недоступна';
    }
  }

  function bindTaskLearningSettings() {
    const tl = () => s('taskLearning') || {};

    const enabled = $('set-task-learning-enabled');
    const comments = $('set-task-learning-comments');
    const attachments = $('set-task-learning-attachments');
    const scope = $('set-task-learning-scope');
    const maxEl = $('set-task-learning-max');
    const chunksEl = $('set-task-learning-chunks');
    const cloud = $('set-task-learning-cloud');

    if (enabled) enabled.checked = tl().enabled !== false;
    if (comments) comments.checked = tl().indexComments !== false;
    if (attachments) attachments.checked = tl().indexAttachments !== false;
    if (scope) scope.value = tl().scope || 'all_visible';
    if (maxEl) maxEl.value = tl().maxIssuesPerSync ?? 100;
    if (chunksEl) chunksEl.value = tl().maxChunks ?? 80000;
    if (cloud) cloud.checked = tl().cloudSync === true;

    const savePatch = async (patch) => {
      await window.api.taskKnowledgeSaveSettings?.(patch);
      config = await window.api.getConfig();
      applyAppSettings(config.settings);
      refreshTaskLearningStats();
    };

    enabled?.addEventListener('change', () => savePatch({ enabled: enabled.checked }));
    comments?.addEventListener('change', () => savePatch({ indexComments: comments.checked }));
    attachments?.addEventListener('change', () => savePatch({ indexAttachments: attachments.checked }));
    scope?.addEventListener('change', () => savePatch({ scope: scope.value || 'all_visible' }));
    cloud?.addEventListener('change', () => savePatch({ cloudSync: cloud.checked }));
    maxEl?.addEventListener('change', () => {
      const v = Math.max(1, Math.min(300, Number(maxEl.value) || 100));
      savePatch({ maxIssuesPerSync: v });
    });
    chunksEl?.addEventListener('change', () => {
      const v = Math.max(5000, Math.min(250000, Number(chunksEl.value) || 80000));
      savePatch({ maxChunks: v });
    });

    let reindexUnsub = null;
    $('set-task-learning-reindex')?.addEventListener('click', async () => {
      const btn = $('set-task-learning-reindex');
      const progressEl = $('set-task-learning-reindex-progress');
      if (btn) btn.disabled = true;
      if (reindexUnsub) reindexUnsub();
      reindexUnsub = window.api.onTaskKnowledgeReindexProgress?.((p) => {
        if (progressEl && p?.total) {
          progressEl.textContent = `Индексация: ${p.current}/${p.total} (новых: ${p.indexed || 0})`;
        }
      }) || null;
      try {
        const sync = await window.api.metaskSync?.();
        const tasks = sync?.tasks || [];
        const res = await window.api.taskKnowledgeReindex?.({ tasks, liteOnly: true });
        if (progressEl) progressEl.textContent = '';
        alert(res?.ok
          ? `Каталог обновлён: ${res.indexed || 0} новых, ${res.skipped || 0} без изменений, всего ${res.total || 0}`
          : (res?.message || 'Ошибка'));
        refreshTaskLearningStats();
      } finally {
        if (reindexUnsub) reindexUnsub();
        reindexUnsub = null;
        if (btn) btn.disabled = false;
      }
    });

    $('set-task-learning-clear')?.addEventListener('click', async () => {
      if (!confirm('Очистить всю локальную память Konstancia по задачам?')) return;
      await window.api.taskKnowledgeClear?.();
      refreshTaskLearningStats();
    });

    refreshTaskLearningStats();
  }

  function bindAgentSettings() {
    const credentials = $('set-agent-credentials');
    const model = $('set-agent-model');
    const provider = $('set-agent-provider');
    const saveBtn = $('set-agent-save');
    const testBtn = $('set-agent-test');
    const gigaPanel = $('set-agent-gigachat-panel');
    const konstPanel = $('set-agent-konstancia-panel');
    const konstStatus = $('set-konstancia-llm-status');

    function syncProviderPanels() {
      const isKonstancia = (provider?.value || 'konstancia') === 'konstancia';
      gigaPanel?.classList.toggle('hidden', isKonstancia);
      konstPanel?.classList.toggle('hidden', !isKonstancia);
    }

    async function refreshKnowledgeLearningStats() {
      const el = $('set-knowledge-learning-stats');
      if (!el) return;
      try {
        const res = await window.api.knowledgeLearningStats?.();
        const st = res?.stats || {};
        el.textContent = st.chunks
          ? `Чанков: ${st.chunks} · источников: ${st.sources || 0}`
          : 'Пусто — нажмите «Индексировать статьи» или npm run ml:ingest-knowledge';
      } catch {
        el.textContent = 'Статус недоступен';
      }
    }

    async function refreshKonstanciaLlmStatus() {
      if (!konstStatus) return;
      try {
        const st = await window.api.agentGetKonstanciaLlmStatus?.();
        if (st?.mode === 'cloud') konstStatus.textContent = `Облако · ${st.cloudUrl || 'подключено'}`;
        else if (st?.trained) konstStatus.textContent = 'Обучена · локально';
        else if (st?.ready) konstStatus.textContent = 'Базовая · дообучите npm run ml:train:chat';
        else konstStatus.textContent = st?.message || 'Нужен Python + ml/requirements.txt';
      } catch {
        konstStatus.textContent = 'Статус недоступен';
      }
    }

    function fillFromConfig() {
      const a = s('agent') || {};
      if (provider) provider.value = a.provider || 'konstancia';
      syncProviderPanels();
      refreshKonstanciaLlmStatus();
      const cloudUrl = $('set-konstancia-cloud-url');
      const cloudKey = $('set-konstancia-cloud-key');
      if (cloudUrl) cloudUrl.value = a.konstanciaCloudUrl || '';
      if (cloudKey) cloudKey.value = a.konstanciaCloudApiKey || '';
      const knowledgeEnabled = $('set-knowledge-learning-enabled');
      if (knowledgeEnabled) knowledgeEnabled.checked = a.knowledgeLearningEnabled !== false;
      const knowledgeAuto = $('set-knowledge-auto-ingest');
      if (knowledgeAuto) knowledgeAuto.checked = a.knowledgeAutoIngest === true;
      refreshKnowledgeLearningStats();
      if (credentials && a.credentials) credentials.value = a.credentials;
      if (model) model.value = a.model || 'GigaChat';
      const mobbinKey = $('set-mobbin-api-key');
      if (mobbinKey) mobbinKey.value = a.mobbinApiKey || '';
      const mobbinEnabled = $('set-mobbin-enabled');
      if (mobbinEnabled) mobbinEnabled.checked = a.mobbinEnabled !== false;
      const siteBuilder = $('set-site-builder-enabled');
      if (siteBuilder) siteBuilder.checked = a.siteBuilderEnabled !== false;
      const cursorKey = $('set-cursor-api-key');
      if (cursorKey) cursorKey.value = a.cursorApiKey || '';
      const cursorModel = $('set-cursor-model');
      if (cursorModel) cursorModel.value = a.cursorModel || 'composer-2.5';
      const cursorBuild = $('set-cursor-figma-build');
      if (cursorBuild) cursorBuild.checked = a.cursorFigmaBuildEnabled === true;
    }

    fillFromConfig();
    provider?.addEventListener('change', syncProviderPanels);

    $('set-knowledge-learning-ingest')?.addEventListener('click', async () => {
      const progress = $('set-knowledge-learning-progress');
      const btn = $('set-knowledge-learning-ingest');
      if (btn) btn.disabled = true;
      if (progress) progress.textContent = 'Загрузка статей…';
      const unsub = window.api.onKnowledgeLearningIngestProgress?.((p) => {
        if (progress) progress.textContent = `${p.index}/${p.total}: ${p.title || p.sourceId}`;
      });
      try {
        const res = await window.api.knowledgeLearningIngest?.();
        if (progress) {
          progress.textContent = res?.ok
            ? `Готово: ${res.ingested} источников, ${res.export?.chunks || 0} чанков для обучения`
            : (res?.message || 'Ошибка');
        }
        await refreshKnowledgeLearningStats();
      } catch (err) {
        if (progress) progress.textContent = err?.message || String(err);
      } finally {
        unsub?.();
        if (btn) btn.disabled = false;
      }
    });

    $('set-knowledge-learning-clear')?.addEventListener('click', async () => {
      if (!confirm('Очистить индекс статей Konstancia?')) return;
      await window.api.knowledgeLearningClear?.();
      await refreshKnowledgeLearningStats();
    });

    $('set-agent-docs-link')?.addEventListener('click', (event) => {
      event.preventDefault();
      window.api.agentOpenGigaChatDocs?.();
    });
    $('set-mobbin-docs-link')?.addEventListener('click', (event) => {
      event.preventDefault();
      window.api.metaskOpenExternal?.('https://docs.mobbin.com/');
    });
    $('set-cursor-docs-link')?.addEventListener('click', (event) => {
      event.preventDefault();
      window.api.metaskOpenExternal?.('https://cursor.com/dashboard');
    });

    saveBtn?.addEventListener('click', async () => {
      const agentProvider = provider?.value || 'konstancia';
      const creds = {
        credentials: credentials?.value?.trim() || '',
        model: agentProvider === 'konstancia' ? 'Konstancia' : (model?.value || 'GigaChat'),
        provider: agentProvider,
        scope: 'GIGACHAT_API_PERS',
        ignoreTls: true,
        mobbinApiKey: $('set-mobbin-api-key')?.value?.trim() || '',
        mobbinEnabled: $('set-mobbin-enabled')?.checked !== false,
        siteBuilderEnabled: $('set-site-builder-enabled')?.checked !== false,
        cursorApiKey: $('set-cursor-api-key')?.value?.trim() || '',
        cursorModel: $('set-cursor-model')?.value || 'composer-2.5',
        cursorFigmaBuildEnabled: $('set-cursor-figma-build')?.checked === true,
        konstanciaCloudUrl: $('set-konstancia-cloud-url')?.value?.trim() || '',
        konstanciaCloudApiKey: $('set-konstancia-cloud-key')?.value?.trim() || '',
        knowledgeLearningEnabled: $('set-knowledge-learning-enabled')?.checked !== false,
        knowledgeAutoIngest: $('set-knowledge-auto-ingest')?.checked === true,
      };
      if (agentProvider === 'gigachat' && !creds.credentials) {
        alert('Вставьте ключ Authorization (Base64) из GigaChat Studio');
        return;
      }
      await window.api.agentSaveCredentials(creds);
      config = await window.api.getConfig();
      fillFromConfig();
      saveBtn.textContent = 'Сохранено';
      setTimeout(() => { saveBtn.textContent = 'Сохранить'; }, 1800);
    });

    testBtn?.addEventListener('click', async () => {
      if ((provider?.value || 'konstancia') === 'konstancia') {
        await refreshKonstanciaLlmStatus();
        const result = await window.api.agentTestConnection();
        alert(result?.ok ? 'Konstancia отвечает локально' : (result?.message || 'Ошибка'));
        return;
      }
      const creds = {
        credentials: credentials?.value?.trim() || '',
        model: model?.value || 'GigaChat',
        provider: 'gigachat',
      };
      if (!creds.credentials) {
        alert('Сначала вставьте ключ');
        return;
      }
      testBtn.disabled = true;
      testBtn.textContent = '…';
      try {
        await window.api.agentSaveCredentials({
          ...s('agent'),
          ...creds,
        });
        const result = await window.api.agentTestConnection();
        alert(result?.ok ? 'Подключение успешно' : (result?.message || 'Ошибка'));
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Проверить';
      }
    });

    bindToggle('set-agent-task-context', 'agent.useTaskContext');
    bindToggle('set-agent-history', 'agent.keepChatHistory');
    bindToggle('set-agent-clear', 'agent.clearInputAfterSend');
    bindToggle('set-mobbin-enabled', 'agent.mobbinEnabled');
    bindToggle('set-site-builder-enabled', 'agent.siteBuilderEnabled');
    bindToggle('set-cursor-figma-build', 'agent.cursorFigmaBuildEnabled');
    const cursorKeyInput = $('set-cursor-api-key');
    const cursorModelSelect = $('set-cursor-model');
    const persistCursorSettings = async () => {
      await window.api.updateAppSettings?.({
        agent: {
          ...s('agent'),
          cursorApiKey: cursorKeyInput?.value?.trim() || '',
          cursorModel: cursorModelSelect?.value || 'composer-2.5',
          cursorFigmaBuildEnabled: $('set-cursor-figma-build')?.checked === true,
        },
      });
      config = await window.api.getConfig();
    };
    cursorKeyInput?.addEventListener('change', persistCursorSettings);
    cursorModelSelect?.addEventListener('change', persistCursorSettings);

    $('set-cursor-mcp-check')?.addEventListener('click', async () => {
      const btn = $('set-cursor-mcp-check');
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = '…';
      try {
        const r = await window.api.agentCursorFigmaMcpCheck?.();
        alert(r?.message || (r?.ok ? 'OK' : 'Ошибка проверки'));
      } finally {
        btn.disabled = false;
        btn.textContent = 'Figma MCP';
      }
    });
    const mobbinKeyInput = $('set-mobbin-api-key');
    mobbinKeyInput?.addEventListener('change', async () => {
      await window.api.updateAppSettings?.({
        agent: {
          ...s('agent'),
          mobbinApiKey: mobbinKeyInput.value?.trim() || '',
        },
      });
      config = await window.api.getConfig();
    });
  }

  function fillNanobananaFromConfig() {
    const nb = s('nanobanana') || {};
    const apiKey = $('set-nb-api-key');
    if (apiKey) apiKey.value = nb.apiKey || '';
  }

  function bindVtubeStudioSettings() {
    const vts = () => s('vtubeStudio') || {};
    const emotions = () => vts().emotions || {};

    const fill = () => {
      const cfg = vts();
      const em = emotions();
      if ($('set-vts-enabled')) $('set-vts-enabled').checked = cfg.enabled === true;
      if ($('set-vts-live2d-path')) $('set-vts-live2d-path').value = cfg.live2dModelPath || '';
      if ($('set-vts-costume')) {
        $('set-vts-costume').value = cfg.live2dCostume || 'costume_v0000.exp3.json';
      }
      if ($('set-vts-em-neutral')) $('set-vts-em-neutral').value = em.neutral || '';
      if ($('set-vts-em-joy')) $('set-vts-em-joy').value = em.joy || '';
      if ($('set-vts-em-anger')) $('set-vts-em-anger').value = em.anger || '';
      if ($('set-vts-em-thoughtful')) $('set-vts-em-thoughtful').value = em.thoughtful || '';
      if ($('set-vts-em-epiphany')) $('set-vts-em-epiphany').value = em.epiphany || '';
    };

    fill();

    const saveVts = async (patch) => {
      await window.api.updateAppSettings({
        vtubeStudio: {
          ...vts(),
          ...patch,
        },
      });
      config = await window.api.getConfig();
      applyAppSettings(config.settings);
      window.AgentVtuber?.refresh?.();
    };

    $('set-vts-enabled')?.addEventListener('change', (e) => {
      saveVts({ enabled: e.target.checked === true });
    });

    $('set-vts-costume')?.addEventListener('change', (e) => {
      const next = e.target.value || 'costume_v0000.exp3.json';
      saveVts({ live2dCostume: next });
      window.AgentLive2d?.applyCostume?.(next);
    });

    $('set-vts-save')?.addEventListener('click', async () => {
      await saveVts({
        emotions: {
          neutral: $('set-vts-em-neutral')?.value?.trim() || '',
          joy: $('set-vts-em-joy')?.value?.trim() || '',
          anger: $('set-vts-em-anger')?.value?.trim() || '',
          thoughtful: $('set-vts-em-thoughtful')?.value?.trim() || '',
          epiphany: $('set-vts-em-epiphany')?.value?.trim() || '',
        },
      });
      const btn = $('set-vts-save');
      if (btn) {
        btn.textContent = 'Сохранено';
        setTimeout(() => { btn.textContent = 'Сохранить эмоции'; }, 1600);
      }
    });

    async function pickLive2dModel(mode) {
      if (!window.api?.live2dPickModel) {
        alert('Доступно только в приложении SHKF (npm start)');
        return;
      }
      const res = await window.api.live2dPickModel({ mode });
      if (!res?.ok) {
        if (res?.message) alert(res.message);
        return;
      }
      config = res.config || await window.api.getConfig();
      fill();
      window.AgentVtuber?.refreshLive2d?.({ force: true });
      window.AgentVtuber?.refresh?.();
      alert(`Модель: ${res.modelName || 'OK'}\nФайл: ${res.settingsPath || res.entryPath}`);
    }

    $('set-vts-pick-live2d')?.addEventListener('click', () => pickLive2dModel('file'));
    $('set-vts-pick-live2d-dir')?.addEventListener('click', () => pickLive2dModel('directory'));
  }

  function bindNanobananaSettings() {
    const apiKey = $('set-nb-api-key');
    const saveBtn = $('set-nb-save');

    fillNanobananaFromConfig();

    $('set-nb-docs-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.api.metaskOpenExternal?.('https://www.nananobanana.com');
    });
    $('set-nb-api-docs')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.api.nanobananaOpenDocs?.();
    });

    saveBtn?.addEventListener('click', async () => {
      const key = apiKey?.value?.trim() || '';
      if (!key) {
        alert('Вставьте API-ключ (nb_…)');
        return;
      }
      await window.api.nanobananaSaveCredentials({ apiKey: key });
      config = await window.api.getConfig();
      fillNanobananaFromConfig();
      saveBtn.textContent = 'Сохранено';
      setTimeout(() => { saveBtn.textContent = 'Сохранить'; }, 1800);
    });
  }

  async function initSettings() {
    config = await window.api.getConfig();
    applyAppSettings(config.settings);
    enhanceSettingsLayout();

    const auth = window.getAuthState?.();
    const roleLabel = $('settings-role-label');
    if (roleLabel) roleLabel.textContent = auth?.profile?.role || config.settings?.user?.role || '—';

    bindTheme();
    window.initCustomThemesUi?.(config);
    bindSegmented('seg-font-size', 'appearance.fontSize', ['small', 'medium', 'large']);
    bindToggle('set-compact', 'appearance.compactLayout');
    bindToggle('set-player-bar', 'appearance.showPlayerBar');
    bindToggle('set-animations', 'appearance.animationsEnabled');

    bindServerToggle();
    bindUpdaterSettings();
    bindToggle('set-notify-action', 'hotkeys.notifyOnAction');
    bindToggle('set-log-footer', 'hotkeys.logToFooter');

    bindNumber('set-plugin-port', 'connection.pluginPort');
    bindNumber('set-cdp-port', 'connection.cdpPort');

    bindToggle('set-auto-connect', 'figma.autoConnectOnStart');
    bindToggle('set-make-submit', 'figma.makeAutoSubmit');
    bindToggle('set-make-focus', 'figma.makeAutoFocus');
    bindToggle('set-make-desktop', 'figma.preferDesktopApp');

    bindToggle('set-make-suggestions', 'make.showSuggestions');
    bindToggle('set-make-clear', 'make.clearInputAfterSend');
    bindToggle('set-make-history', 'make.keepChatHistory');
    bindSelect('set-speech-lang', 'make.speechLanguage');
    await refreshSpeechLangSelect();
    $('set-speech-lang')?.addEventListener('change', refreshSpeechLangSelect);

    bindToggle('set-template-toast', 'templates.showCopyToast');

    bindKanbanSettings();
    bindTaskLearningSettings();
    bindAgentSettings();
    bindVtubeStudioSettings();
    bindNanobananaSettings();

    bindToggle('set-close-tray', 'window.closeToTray');
    bindToggle('set-start-minimized', 'window.startMinimized');
    bindToggle('set-start-server', 'window.startServerOnLaunch');
    bindToggle('set-show-splash', 'window.showSplash');
    bindNumber('set-splash-ms', 'window.splashDurationMs');
    bindNumber('set-win-width', 'window.width');
    bindNumber('set-win-height', 'window.height');
    $('btn-apply-window-size')?.addEventListener('click', async () => {
      const w = Number($('set-win-width')?.value);
      const h = Number($('set-win-height')?.value);
      if (w >= 960 && h >= 640) {
        await patch('window.width', w);
        await patch('window.height', h);
        await window.api.resizeWindow(w, h);
      }
    });

    bindNumber('set-search-max', 'search.maxResults');

    bindToggle('set-verbose-logs', 'advanced.verboseLogs');

    $('btn-open-config')?.addEventListener('click', () => window.api.openConfigFolder());
    $('btn-open-plugin')?.addEventListener('click', () => window.api.openPluginFolder());
    $('btn-reset-onboarding')?.addEventListener('click', async () => {
      if (!confirm('Показать онбординг при следующем запуске?')) return;
      config = await window.api.resetOnboarding();
    });
    $('btn-export-config')?.addEventListener('click', () => window.api.exportConfig());
    $('btn-import-config')?.addEventListener('click', async () => {
      const result = await window.api.importConfig();
      if (result?.ok) {
        config = result.config;
        applyAppSettings(config.settings);
        location.reload();
      }
    });
    $('btn-reset-settings')?.addEventListener('click', async () => {
      if (!confirm('Сбросить все настройки к значениям по умолчанию?')) return;
      config = await window.api.resetAppSettings();
      applyAppSettings(config.settings);
      location.reload();
    });

    window.api.onConfig((c) => {
      config = c;
      applyAppSettings(c.settings);
      const roleLabel = $('settings-role-label');
      if (roleLabel) roleLabel.textContent = window.getAuthState?.()?.profile?.role || c.settings?.user?.role || '—';
      fillNanobananaFromConfig();
      syncThemePicker(c.theme || 'light');
      window.refreshCustomThemesUi?.(c);
      window.customThemeEngine?.injectCustomThemeStyles(c);
    });
  }

  window.initSettings = initSettings;

  const SETTINGS_ICONS = {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    badge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l2.4 4.8 5.4.8-3.9 3.8.9 5.3L12 14.8 7.2 16.7l.9-5.3L4.2 7.6l5.4-.8L12 2z"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2" fill="currentColor"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/><circle cx="16" cy="10" r="1.2" fill="currentColor"/></svg>',
    type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
    layout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l1.8 5.5L19 10l-5.2 1.5L12 17l-1.8-5.5L5 10l5.2-1.5L12 3z"/></svg>',
    keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>',
    log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h14"/></svg>',
    plug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22v-5M9 8V2h6v6M7 8h10v4a5 5 0 01-10 0V8z"/></svg>',
    port: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4M7 12h10M7 16h6"/></svg>',
    update: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 11-2.64-6.36"/><path d="M21 4v5h-5"/></svg>',
    figma: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 24a4 4 0 004-4v-4H8a4 4 0 000 8zM8 12h4a4 4 0 000-8H8v8zM8 0h4a4 4 0 010 8H8V0zM16 8a4 4 0 000-8h-4v8h4zM16 12a4 4 0 010 8h-4v-8h4z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8.3v.5z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 17v5"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="4"/><path d="M12 12l8 8M16 8h5M19 5v6"/></svg>',
    brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4a3 3 0 00-3 3v1a3 3 0 001 5.7V16a3 3 0 006 0v-2.3A3 3 0 0016 8V7a3 3 0 00-3-3"/><path d="M12 4v16"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 15l-5-5L5 19"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
    kanban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="5" height="13" rx="1"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 18h11a4 4 0 000-8 5.5 5.5 0 00-10.6-1.5A3.5 3.5 0 007 18z"/></svg>',
    window: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 7l3 3-8 8H6v-3l8-8z"/><path d="M16 5l3 3"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>',
  };

  const SETTINGS_SECTIONS = {
    'Аккаунт и роль': { desc: 'Вход, роль и доступ к разделам приложения', icon: 'user', tone: 'blue', image: null },
    'Внешний вид': { desc: 'Тема, масштаб текста и поведение интерфейса', icon: 'palette', tone: 'violet' },
    'Хоткеи и сервер': { desc: 'SHKF Bridge, порты и уведомления о действиях', icon: 'keyboard', tone: 'slate' },
    'Обновления': { desc: 'Версия приложения и установка новых сборок', icon: 'update', tone: 'green' },
    'Figma и Make': { desc: 'CDP, автоподключение и Figma Desktop', icon: 'figma', tone: 'purple', image: 'assets/icons/figma.png' },
    'Make it — чат': { desc: 'Подсказки, история и голосовой ввод', icon: 'chat', tone: 'orange' },
    'Konstancia · нейросеть': { desc: 'Локальная модель Konstancia, Mobbin, Cursor', icon: 'brain', tone: 'teal', image: 'assets/agent/agent-avatar.png' },
    'Konstancia · Live2D': { desc: 'Анимированная Live2D-модель и motions эмоций', icon: 'spark', tone: 'violet' },
    'NanoBanana': { desc: 'API-ключ для генерации изображений', icon: 'image', tone: 'yellow', image: 'assets/icons/nanobanana.png' },
    Templates: { desc: 'Уведомления при копировании шаблонов', icon: 'copy', tone: 'pink' },
    'Канбан (Redmine)': { desc: 'URL, API-ключ и опрос задач с доски', icon: 'kanban', tone: 'red', image: 'assets/icons/redmine.png' },
    'Konstancia · обучение из Redmine': { desc: 'Индекс уроков и локальная память агента', icon: 'brain', tone: 'teal' },
    'Окно и запуск': { desc: 'Трей, splash и размер окна', icon: 'window', tone: 'slate' },
    Поиск: { desc: 'Глобальный поиск по разделам и настройкам', icon: 'search', tone: 'blue' },
    Дополнительно: { desc: 'Логи, конфиг и служебные действия', icon: 'wrench', tone: 'gray' },
  };

  const ITEM_ICON_BY_ID = {
    'toggle-server': 'keyboard',
    'set-notify-action': 'bell',
    'set-log-footer': 'log',
    'set-plugin-port': 'port',
    'set-cdp-port': 'plug',
    'set-updater-check': 'update',
    'set-auto-connect': 'link',
    'set-make-submit': 'figma',
    'set-make-focus': 'window',
    'set-make-desktop': 'figma',
    'set-make-suggestions': 'spark',
    'set-make-clear': 'chat',
    'set-make-history': 'chat',
    'set-speech-lang': 'mic',
    'set-agent-credentials': 'key',
    'set-agent-model': 'brain',
    'set-agent-task-context': 'kanban',
    'set-agent-history': 'chat',
    'set-agent-clear': 'chat',
    'set-mobbin-api-key': 'key',
    'set-mobbin-enabled': 'search',
    'set-site-builder-enabled': 'code',
    'set-cursor-api-key': 'key',
    'set-nb-api-key': 'image',
    'set-template-toast': 'bell',
    'set-kanban-url': 'kanban',
    'set-kanban-notify': 'bell',
    'set-kanban-poll': 'update',
    'set-task-learning-enabled': 'brain',
    'set-task-learning-comments': 'chat',
    'set-task-learning-cloud': 'cloud',
    'set-close-tray': 'window',
    'set-start-minimized': 'window',
    'set-start-server': 'keyboard',
    'set-show-splash': 'spark',
    'set-splash-ms': 'spark',
    'set-win-width': 'layout',
    'set-search-max': 'search',
    'set-verbose-logs': 'log',
    'set-compact': 'layout',
    'set-player-bar': 'log',
    'set-animations': 'spark',
  };

  function settingsIcon(name) {
    return SETTINGS_ICONS[name] || SETTINGS_ICONS.default;
  }

  function guessItemIcon(label, id) {
    if (id && ITEM_ICON_BY_ID[id]) return ITEM_ICON_BY_ID[id];
    const t = String(label || '').toLowerCase();
    if (/аккаунт|роль|пользов/.test(t)) return 'user';
    if (/тема|внешн|шрифт|анимац|компакт|панел/.test(t)) return 'palette';
    if (/хотк|клав|сервер/.test(t)) return 'keyboard';
    if (/уведом|toast/.test(t)) return 'bell';
    if (/порт|cdp|plugin/.test(t)) return 'port';
    if (/figma|make|макет/.test(t)) return 'figma';
    if (/gigachat|kost|агент|mobbin|cursor/.test(t)) return 'brain';
    if (/redmine|kanban|задач/.test(t)) return 'kanban';
    if (/nano|изображ|баннер/.test(t)) return 'image';
    if (/окно|трей|splash|запуск/.test(t)) return 'window';
    if (/поиск/.test(t)) return 'search';
    if (/ключ|api|token/.test(t)) return 'key';
    return 'default';
  }

  function slugifySettings(text) {
    return String(text || '').trim().toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]+/gi, '-').replace(/^-+|-+$/g, '');
  }

  function createSettingsIconEl(kind, { image } = {}) {
    const el = document.createElement('span');
    el.className = `settings-item-icon settings-item-icon--${kind}`;
    el.setAttribute('aria-hidden', 'true');
    if (image) {
      el.classList.add('settings-item-icon--photo');
      el.innerHTML = `<img src="${image}" alt="" loading="lazy" decoding="async" />`;
    } else {
      el.innerHTML = settingsIcon(kind);
    }
    return el;
  }

  function syncSettingsAccountAvatar(sectionHeadIcon) {
    const sidebarAvatar = document.querySelector('#sidebar-user-avatar img');
    if (!sidebarAvatar?.src || sectionHeadIcon?.querySelector('img')) return;
    const img = document.createElement('img');
    img.src = sidebarAvatar.src;
    img.alt = '';
    sectionHeadIcon.innerHTML = '';
    sectionHeadIcon.classList.add('settings-section-icon--photo');
    sectionHeadIcon.appendChild(img);
  }

  function enhanceSettingsLayout() {
    const scroll = document.querySelector('#page-settings .settings-scroll');
    const quickNav = $('settings-quick-nav');
    if (!scroll || scroll.dataset.enhanced) return;
    scroll.dataset.enhanced = '1';

    document.querySelectorAll('#page-settings .settings-section').forEach((section) => {
      const titleEl = section.querySelector('.settings-section-title');
      if (!titleEl) return;
      const title = titleEl.textContent.trim();
      const meta = SETTINGS_SECTIONS[title] || { desc: '', icon: 'default', tone: 'slate' };
      if (!section.id) section.id = `settings-sec-${slugifySettings(title)}`;

      const head = document.createElement('div');
      head.className = 'settings-section-head';
      const iconWrap = document.createElement('span');
      iconWrap.className = `settings-section-icon settings-section-icon--${meta.tone || 'slate'}`;
      if (meta.image) {
        iconWrap.classList.add('settings-section-icon--photo');
        iconWrap.innerHTML = `<img src="${meta.image}" alt="" loading="lazy" decoding="async" />`;
      } else {
        iconWrap.innerHTML = settingsIcon(meta.icon || 'default');
      }
      head.innerHTML = `
        <div class="settings-section-head-text">
          <h2 class="settings-section-heading">${title}</h2>
          ${meta.desc ? `<p class="settings-section-desc">${meta.desc}</p>` : ''}
        </div>`;
      head.prepend(iconWrap);
      titleEl.replaceWith(head);

      if (title === 'Аккаунт и роль') syncSettingsAccountAvatar(iconWrap);

      if (quickNav) {
        const link = document.createElement('a');
        link.className = 'settings-quick-link';
        link.href = `#${section.id}`;
        link.textContent = title.split('(')[0].split('·')[0].trim();
        link.addEventListener('click', (e) => {
          e.preventDefault();
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        quickNav.appendChild(link);
      }
    });

    document.querySelectorAll('#page-settings .settings-item').forEach((item) => {
      if (item.querySelector('.settings-item-icon')) return;
      if (item.classList.contains('settings-item--themes')) return;
      if (item.classList.contains('settings-item--stack') || item.classList.contains('settings-item-stack')) return;
      const control = item.querySelector('[id]');
      const id = control?.id;
      const label = item.querySelector('.settings-label')?.textContent?.trim();
      let iconKind = guessItemIcon(label, id);
      let image = null;
      if (/рабочий аккаунт/i.test(label || '')) {
        const av = document.querySelector('#sidebar-user-avatar img');
        if (av?.src) image = av.src;
        iconKind = 'user';
      }
      if (/Konstancia|gigachat/i.test(label || '') && !image) {
        image = 'assets/agent/agent-avatar.png';
      }
      item.prepend(createSettingsIconEl(iconKind, { image }));
    });
  }
})();
