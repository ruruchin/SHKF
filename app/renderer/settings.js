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
    syncThemePicker(cfg?.theme || config?.theme || 'dark');
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

  function bindAgentSettings() {
    const credentials = $('set-agent-credentials');
    const model = $('set-agent-model');
    const saveBtn = $('set-agent-save');
    const testBtn = $('set-agent-test');

    function fillFromConfig() {
      const a = s('agent') || {};
      if (credentials && a.credentials) credentials.value = a.credentials;
      if (model) model.value = a.model || 'GigaChat';
    }

    fillFromConfig();

    $('set-agent-docs-link')?.addEventListener('click', (event) => {
      event.preventDefault();
      window.api.agentOpenGigaChatDocs?.();
    });

    saveBtn?.addEventListener('click', async () => {
      const creds = {
        credentials: credentials?.value?.trim() || '',
        model: model?.value || 'GigaChat',
        provider: 'gigachat',
        scope: 'GIGACHAT_API_PERS',
        ignoreTls: true,
      };
      if (!creds.credentials) {
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
      const creds = {
        credentials: credentials?.value?.trim() || '',
        model: model?.value || 'GigaChat',
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
  }

  function fillNanobananaFromConfig() {
    const nb = s('nanobanana') || {};
    const apiKey = $('set-nb-api-key');
    if (apiKey) apiKey.value = nb.apiKey || '';
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
    bindAgentSettings();
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
      syncThemePicker(c.theme || 'dark');
      window.refreshCustomThemesUi?.(c);
      window.customThemeEngine?.injectCustomThemeStyles(c);
    });
  }

  window.initSettings = initSettings;
})();
