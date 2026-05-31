(function () {
  const CUSTOM_THEME_PREFIX = 'custom-';
  const COLOR_FIELDS = [
    { key: 'shell', label: 'Фон' },
    { key: 'sidebar', label: 'Сайдбар' },
    { key: 'panel', label: 'Панели' },
    { key: 'text', label: 'Текст' },
    { key: 'accent', label: 'Акцент' },
  ];
  const DEFAULT_TAG_COLORS = ['#ff6b8a', '#6bc5ff', '#6bffd4', '#b88bff', '#ffc46b'];
  const TAG_LABELS = ['Плашка 1', 'Плашка 2', 'Плашка 3', 'Плашка 4', 'Плашка 5'];

  function buildCustomThemeCss(theme) {
    if (!theme) return '';
    const c = theme.colors || {};
    const tags = theme.tagColors || DEFAULT_TAG_COLORS;
    const lines = [
      `--shell: ${c.shell || '#070608'};`,
      `--sidebar: ${c.sidebar || '#0c0a0f'};`,
      `--panel: ${c.panel || '#121018'};`,
      `--panel-hover: ${c.panel || '#1a1624'};`,
      `--elevated: ${c.panel || '#181420'};`,
      `--border: rgba(255, 255, 255, 0.4);`,
      `--text: ${c.text || '#f8f6fc'};`,
      `--text-secondary: rgba(235, 230, 245, 0.74);`,
      `--text-muted: rgba(190, 185, 205, 0.48);`,
      `--accent: ${c.accent || '#ff6b8a'};`,
      `--accent-text: #0a0a0a;`,
      `--accent-hover: ${c.accent || '#ff6b8a'};`,
      `--accent-dim: rgba(255, 255, 255, 0.12);`,
      `--input-bg: rgba(255, 255, 255, 0.06);`,
      `--modal-bg: ${c.panel || '#141018'};`,
      `--shadow: rgba(0, 0, 0, 0.75);`,
      `--cursor-bg: ${c.accent || '#ff6b8a'};`,
      `--cursor-arrow: #0a0a0a;`,
      `--mp-coral: ${tags[0]};`,
      `--mp-sky: ${tags[1]};`,
      `--mp-mint: ${tags[2]};`,
      `--mp-lavender: ${tags[3]};`,
      `--mp-amber: ${tags[4]};`,
    ];
    return `[data-theme="${theme.id}"] {\n  ${lines.join('\n  ')}\n}`;
  }

  window.buildCustomThemeCss = buildCustomThemeCss;

  const BUILTIN_MEDIA = {
    manga: {
      img: 'assets/manga/girl-peace.png',
      video: null,
    },
    mangaplus: {
      img: 'assets/manga/girl-peace.png',
      video: 'assets/mangaplus/sidebar-loop.mp4',
      poster: 'assets/mangaplus/sidebar-poster.jpg',
    },
  };

  const TAG_CLASS_NAMES = ['mp-tag-coral', 'mp-tag-sky', 'mp-tag-mint', 'mp-tag-lavender', 'mp-tag-amber'];

  function isCustomTheme(themeId) {
    return typeof themeId === 'string' && themeId.startsWith('custom-');
  }

  function getCustomThemes(config) {
    return config?.settings?.appearance?.customThemes || [];
  }

  function getCustomTheme(config, themeId) {
    return getCustomThemes(config).find((t) => t.id === themeId) || null;
  }

  function buildAllThemeStyles(themes) {
    if (!window.buildCustomThemeCss) return '';
    return (themes || []).map((t) => window.buildCustomThemeCss(t)).join('\n');
  }

  function injectCustomThemeStyles(config) {
    let el = document.getElementById('custom-theme-vars');
    if (!el) {
      el = document.createElement('style');
      el.id = 'custom-theme-vars';
      document.head.appendChild(el);
    }
    el.textContent = buildAllThemeStyles(getCustomThemes(config));
  }

  function resetBuiltinSidebarMedia() {
    const img = document.querySelector('.sidebar-character-img');
    const vid = document.querySelector('.sidebar-character-vid');
    const wrap = document.querySelector('.sidebar-character');
    if (img) {
      img.src = BUILTIN_MEDIA.manga.img;
      img.style.display = '';
    }
    if (vid) {
      vid.pause();
      vid.currentTime = 0;
      vid.style.display = '';
      const source = vid.querySelector('source');
      if (source) source.src = BUILTIN_MEDIA.mangaplus.video;
      vid.removeAttribute('poster');
      vid.load();
    }
    wrap?.classList.remove('is-empty');
  }

  async function applySidebarMedia(themeId, config) {
    const img = document.querySelector('.sidebar-character-img');
    const vid = document.querySelector('.sidebar-character-vid');
    const wrap = document.querySelector('.sidebar-character');
    if (!img || !vid || !wrap) return;

    resetBuiltinSidebarMedia();

    if (themeId === 'manga') {
      img.style.display = '';
      vid.style.display = 'none';
      vid.pause();
      return;
    }

    if (themeId === 'mangaplus') {
      img.style.display = 'none';
      vid.style.display = '';
      const source = vid.querySelector('source');
      if (source) source.src = BUILTIN_MEDIA.mangaplus.video;
      vid.poster = BUILTIN_MEDIA.mangaplus.poster;
      vid.load();
      vid.play().catch(() => {});
      return;
    }

    if (!isCustomTheme(themeId)) {
      img.style.display = 'none';
      vid.style.display = 'none';
      vid.pause();
      wrap.classList.add('is-empty');
      return;
    }

    const theme = getCustomTheme(config, themeId);
    if (!theme || theme.media?.sidebarType === 'none' || !theme.media?.sidebarFile) {
      img.style.display = 'none';
      vid.style.display = 'none';
      vid.pause();
      wrap.classList.add('is-empty');
      return;
    }

    const url = await window.api.getCustomThemeMediaUrl(themeId, theme.media.sidebarFile);
    if (!url) {
      wrap.classList.add('is-empty');
      return;
    }

    wrap.classList.remove('is-empty');

    if (theme.media.sidebarType === 'video') {
      img.style.display = 'none';
      vid.style.display = '';
      const source = vid.querySelector('source');
      if (source) source.src = url;
      vid.removeAttribute('poster');
      if (theme.media.posterFile) {
        const posterUrl = await window.api.getCustomThemeMediaUrl(themeId, theme.media.posterFile);
        if (posterUrl) vid.poster = posterUrl;
      }
      vid.load();
      vid.play().catch(() => {});
      return;
    }

    vid.style.display = 'none';
    vid.pause();
    img.style.display = '';
    img.src = url;
  }

  function getThemePickerItems(config) {
    const builtIn = window.APP_THEMES || [];
    const custom = getCustomThemes(config).map((t) => ({
      id: t.id,
      label: t.label,
      swatch: 'custom',
      accent: t.colors?.accent || '#ff6b8a',
    }));
    return [...builtIn, ...custom];
  }

  window.customThemeEngine = {
    isCustomTheme,
    getCustomThemes,
    getCustomTheme,
    getThemePickerItems,
    injectCustomThemeStyles,
    applySidebarMedia,
    TAG_CLASS_NAMES,
  };
})();
