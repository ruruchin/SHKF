export const CUSTOM_THEME_PREFIX = 'custom-';

export const CUSTOM_THEME_COLOR_FIELDS = [
  { key: 'shell', label: 'Фон приложения', default: '#070608' },
  { key: 'sidebar', label: 'Сайдбар', default: '#0c0a0f' },
  { key: 'panel', label: 'Панели', default: '#121018' },
  { key: 'text', label: 'Текст', default: '#f8f6fc' },
  { key: 'accent', label: 'Акцент', default: '#ff6b8a' },
];

export const DEFAULT_TAG_COLORS = ['#ff6b8a', '#6bc5ff', '#6bffd4', '#b88bff', '#ffc46b'];

export function isCustomThemeId(themeId) {
  return typeof themeId === 'string' && themeId.startsWith(CUSTOM_THEME_PREFIX);
}

export function createCustomThemeId() {
  return CUSTOM_THEME_PREFIX + Math.random().toString(36).slice(2, 10);
}

export function createEmptyCustomTheme(overrides = {}) {
  const colors = Object.fromEntries(
    CUSTOM_THEME_COLOR_FIELDS.map(({ key, default: def }) => [key, def])
  );
  return {
    id: createCustomThemeId(),
    label: 'Моя тема',
    colors: { ...colors, ...(overrides.colors || {}) },
    tagColors: [...(overrides.tagColors || DEFAULT_TAG_COLORS)],
    media: {
      sidebarType: 'none',
      sidebarFile: '',
      posterFile: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function normalizeCustomTheme(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const base = createEmptyCustomTheme();
  const tagColors = Array.isArray(raw.tagColors) && raw.tagColors.length
    ? raw.tagColors.slice(0, 5).map(String)
    : base.tagColors;
  while (tagColors.length < 5) tagColors.push(DEFAULT_TAG_COLORS[tagColors.length]);

  return {
    id: raw.id && isCustomThemeId(raw.id) ? raw.id : createCustomThemeId(),
    label: String(raw.label || base.label).slice(0, 48),
    colors: { ...base.colors, ...(raw.colors || {}) },
    tagColors,
    media: {
      sidebarType: ['none', 'image', 'video'].includes(raw.media?.sidebarType)
        ? raw.media.sidebarType
        : 'none',
      sidebarFile: String(raw.media?.sidebarFile || ''),
      posterFile: String(raw.media?.posterFile || ''),
    },
    createdAt: raw.createdAt || base.createdAt,
    updatedAt: raw.updatedAt || base.updatedAt,
  };
}

export function normalizeCustomThemes(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list
    .map(normalizeCustomTheme)
    .filter(Boolean)
    .filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
}

export function buildCustomThemeCss(theme) {
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
