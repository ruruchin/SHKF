(function () {
  let config = null;
  let editingTheme = null;

  function $(id) {
    return document.getElementById(id);
  }

  function createThemeDraft(base) {
    const id = base?.id || ('custom-' + Math.random().toString(36).slice(2, 10));
    return {
      id,
      label: base?.label || 'Моя тема',
      colors: {
        shell: base?.colors?.shell || '#070608',
        sidebar: base?.colors?.sidebar || '#0c0a0f',
        panel: base?.colors?.panel || '#121018',
        text: base?.colors?.text || '#f8f6fc',
        accent: base?.colors?.accent || '#ff6b8a',
      },
      tagColors: [...(base?.tagColors || ['#ff6b8a', '#6bc5ff', '#6bffd4', '#b88bff', '#ffc46b'])],
      media: {
        sidebarType: base?.media?.sidebarType || 'none',
        sidebarFile: base?.media?.sidebarFile || '',
        posterFile: base?.media?.posterFile || '',
      },
      createdAt: base?.createdAt || new Date().toISOString(),
      updatedAt: base?.updatedAt || new Date().toISOString(),
    };
  }

  function mediaLabel(theme) {
    if (theme.media?.sidebarType === 'video') return 'Видео';
    if (theme.media?.sidebarType === 'image') return 'Картинка';
    return 'Без медиа';
  }

  function renderList() {
    const list = $('custom-themes-list');
    if (!list) return;
    const themes = window.customThemeEngine?.getCustomThemes(config) || [];
    if (!themes.length) {
      list.innerHTML = '<div class="custom-themes-empty">Пока нет своих тем — создайте первую ниже</div>';
      return;
    }
    list.innerHTML = themes.map((t) => `
      <div class="custom-theme-row" data-id="${t.id}">
        <span class="custom-theme-row-swatch" style="background:${t.colors?.accent || '#ff6b8a'}"></span>
        <div class="custom-theme-row-info">
          <div class="custom-theme-row-name">${escapeHtml(t.label)}</div>
          <div class="custom-theme-row-meta">${mediaLabel(t)} · ${escapeHtml(t.id)}</div>
        </div>
        <div class="custom-theme-row-actions">
          <button type="button" class="btn-ghost btn-sm" data-action="apply" data-id="${t.id}">Выбрать</button>
          <button type="button" class="btn-ghost btn-sm" data-action="edit" data-id="${t.id}">Изменить</button>
          <button type="button" class="btn-ghost btn-sm" data-action="delete" data-id="${t.id}">Удалить</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-action]').forEach((btn) => {
      btn.onclick = () => handleRowAction(btn.dataset.action, btn.dataset.id);
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function handleRowAction(action, themeId) {
    const theme = window.customThemeEngine.getCustomTheme(config, themeId);
    if (!theme) return;

    if (action === 'apply') {
      if (window.applyTheme) window.applyTheme(themeId);
      config = await window.api.setTheme(themeId);
      window.renderThemePicker?.(config);
      return;
    }
    if (action === 'edit') {
      openEditor(theme);
      return;
    }
    if (action === 'delete') {
      if (!confirm(`Удалить тему «${theme.label}»?`)) return;
      config = await window.api.deleteCustomTheme(themeId);
      window.customThemeEngine.injectCustomThemeStyles(config);
      renderList();
      window.renderThemePicker?.(config);
      if ((config.theme || '') === themeId && window.applyTheme) {
        window.applyTheme('dark');
      }
    }
  }

  function openEditor(theme) {
    editingTheme = createThemeDraft(theme);
    const editor = $('custom-theme-editor');
    editor?.classList.remove('hidden');
    $('custom-theme-editor-title').textContent = theme?.id && config?.settings?.appearance?.customThemes?.some((t) => t.id === theme.id)
      ? 'Редактировать тему'
      : 'Новая тема';

    $('ct-name').value = editingTheme.label;
    ['shell', 'sidebar', 'panel', 'text', 'accent'].forEach((key) => {
      const el = $(`ct-color-${key}`);
      if (el) el.value = editingTheme.colors[key];
    });
    editingTheme.tagColors.forEach((color, i) => {
      const el = $(`ct-tag-${i}`);
      if (el) el.value = color;
    });

    updateMediaPreview();
  }

  function closeEditor() {
    editingTheme = null;
    $('custom-theme-editor')?.classList.add('hidden');
  }

  function collectDraft() {
    if (!editingTheme) return null;
    editingTheme.label = $('ct-name')?.value?.trim() || 'Моя тема';
    ['shell', 'sidebar', 'panel', 'text', 'accent'].forEach((key) => {
      editingTheme.colors[key] = $(`ct-color-${key}`)?.value || editingTheme.colors[key];
    });
    editingTheme.tagColors = [0, 1, 2, 3, 4].map((i) => $(`ct-tag-${i}`)?.value || editingTheme.tagColors[i]);
    return editingTheme;
  }

  async function updateMediaPreview() {
    const preview = $('ct-media-preview');
    const hint = $('ct-media-hint');
    if (!preview || !editingTheme) return;

    preview.style.display = 'none';
    preview.removeAttribute('src');
    if (hint) {
      hint.textContent = editingTheme.media.sidebarType === 'none'
        ? 'Картинка или видео внизу сайдбара (как в MangaPlus)'
        : `${mediaLabel(editingTheme)}: ${editingTheme.media.sidebarFile || '—'}`;
    }

    if (!editingTheme.media.sidebarFile) return;
    const url = await window.api.getCustomThemeMediaUrl(editingTheme.id, editingTheme.media.sidebarFile);
    if (!url) return;

    if (editingTheme.media.sidebarType === 'video') {
      preview.style.display = 'none';
      if (hint) hint.textContent = `Видео: ${editingTheme.media.sidebarFile}`;
      return;
    }

    preview.src = url;
    preview.style.display = 'block';
  }

  async function pickMedia(role) {
    if (!editingTheme) return;
    const result = await window.api.pickCustomThemeMedia(editingTheme.id, role);
    if (!result?.ok) {
      if (result?.message) alert(result.message);
      return;
    }
    if (result.config) config = result.config;
    const saved = window.customThemeEngine.getCustomTheme(config, editingTheme.id);
    if (saved) {
      editingTheme.media = { ...saved.media };
    } else {
      if (role === 'poster') editingTheme.media.posterFile = result.filename;
      else {
        editingTheme.media.sidebarFile = result.filename;
        editingTheme.media.sidebarType = result.sidebarType || 'image';
      }
    }
    updateMediaPreview();
  }

  async function saveEditor() {
    const draft = collectDraft();
    if (!draft) return;
    config = await window.api.saveCustomTheme(draft);
    window.customThemeEngine.injectCustomThemeStyles(config);
    renderList();
    window.renderThemePicker?.(config);
    closeEditor();
  }

  function buildEditorHtml() {
    const colorFields = [
      { key: 'shell', label: 'Фон' },
      { key: 'sidebar', label: 'Сайдбар' },
      { key: 'panel', label: 'Панели' },
      { key: 'text', label: 'Текст' },
      { key: 'accent', label: 'Акцент' },
    ];
    const tagFields = [0, 1, 2, 3, 4].map((i) => ({
      id: `ct-tag-${i}`,
      label: `Плашка ${i + 1}`,
    }));

    return `
      <div class="custom-themes-block">
        <div class="custom-themes-head">
          <h3>Мои темы</h3>
          <button type="button" class="btn-primary btn-sm" id="btn-custom-theme-new">+ Создать</button>
        </div>
        <div class="custom-themes-list" id="custom-themes-list"></div>
        <div class="custom-theme-editor hidden" id="custom-theme-editor">
          <div class="settings-label" id="custom-theme-editor-title">Новая тема</div>
          <div class="custom-theme-field">
            <label for="ct-name">Название</label>
            <input type="text" id="ct-name" maxlength="48" placeholder="Моя тема" />
          </div>
          <div class="custom-theme-field">
            <label>Цвета интерфейса</label>
            <div class="custom-theme-colors">
              ${colorFields.map((f) => `
                <div class="custom-theme-color-item">
                  <span>${f.label}</span>
                  <input type="color" id="ct-color-${f.key}" />
                </div>
              `).join('')}
            </div>
          </div>
          <div class="custom-theme-field">
            <label>Цвета плашек проектов (Канбан)</label>
            <div class="custom-theme-colors">
              ${tagFields.map((f) => `
                <div class="custom-theme-color-item">
                  <span>${f.label}</span>
                  <input type="color" id="${f.id}" />
                </div>
              `).join('')}
            </div>
          </div>
          <div class="custom-theme-field">
            <label>Контент в сайдбаре</label>
            <div class="custom-theme-media-row">
              <img class="custom-theme-media-preview" id="ct-media-preview" alt="" />
              <div>
                <div class="custom-theme-media-row">
                  <button type="button" class="btn-ghost btn-sm" id="ct-pick-sidebar">Картинка / видео</button>
                  <button type="button" class="btn-ghost btn-sm" id="ct-pick-poster">Постер (видео)</button>
                  <button type="button" class="btn-ghost btn-sm" id="ct-clear-media">Убрать</button>
                </div>
                <div class="custom-theme-media-hint" id="ct-media-hint">Картинка или видео внизу сайдбара</div>
              </div>
            </div>
          </div>
          <div class="custom-theme-editor-actions">
            <button type="button" class="btn-primary btn-sm" id="ct-save">Сохранить тему</button>
            <button type="button" class="btn-ghost btn-sm" id="ct-cancel">Отмена</button>
          </div>
        </div>
      </div>
    `;
  }

  function mountEditor() {
    const host = $('custom-themes-host');
    if (!host || host.dataset.mounted) return;
    host.innerHTML = buildEditorHtml();
    host.dataset.mounted = '1';

    $('btn-custom-theme-new')?.addEventListener('click', () => openEditor(null));
    $('ct-save')?.addEventListener('click', saveEditor);
    $('ct-cancel')?.addEventListener('click', closeEditor);
    $('ct-pick-sidebar')?.addEventListener('click', () => pickMedia('sidebar'));
    $('ct-pick-poster')?.addEventListener('click', () => pickMedia('poster'));
    $('ct-clear-media')?.addEventListener('click', async () => {
      if (!editingTheme) return;
      editingTheme.media = { sidebarType: 'none', sidebarFile: '', posterFile: '' };
      const draft = collectDraft();
      config = await window.api.saveCustomTheme(draft);
      updateMediaPreview();
    });
  }

  window.initCustomThemesUi = function initCustomThemesUi(cfg) {
    config = cfg;
    mountEditor();
    renderList();
  };

  window.refreshCustomThemesUi = function refreshCustomThemesUi(cfg) {
    config = cfg;
    renderList();
  };
})();
