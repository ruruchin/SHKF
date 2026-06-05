/** Фильтры PIK-FOLDER — платформа и тип экрана (как в Mobbin). */

export const PIK_PLATFORMS = [
  { id: 'all', label: 'Все' },
  { id: 'web', label: 'Web' },
  { id: 'ios', label: 'iOS' },
];

/** Типы экранов → Mobbin search query из каталога */
export const PIK_SCREEN_TYPES = [
  { id: 'all', label: 'Все экраны' },
  { id: 'onboarding', label: 'Онбординг', queries: ['onboarding flow', 'wizard stepper'] },
  { id: 'auth', label: 'Вход / регистрация', queries: ['login sign in'] },
  { id: 'landing', label: 'Landing', queries: ['saas landing page', 'portfolio website', 'referral program page', 'cookie consent banner'] },
  { id: 'pricing', label: 'Pricing', queries: ['pricing page', 'billing subscription'] },
  { id: 'checkout', label: 'Checkout', queries: ['checkout payment'] },
  { id: 'dashboard', label: 'Dashboard', queries: ['dashboard saas', 'crm dashboard', 'analytics platform', 'admin panel', 'file manager', 'calendar scheduling'] },
  { id: 'settings', label: 'Settings', queries: ['settings page', 'profile settings'] },
  { id: 'search', label: 'Search', queries: ['search results', 'command palette'] },
  { id: 'forms', label: 'Forms', queries: ['form inputs', 'file upload', 'team invite', 'filter sort ui'] },
  { id: 'tables', label: 'Tables / Kanban', queries: ['data table', 'kanban board', 'card grid'] },
  { id: 'charts', label: 'Charts', queries: ['charts analytics'] },
  { id: 'navigation', label: 'Navigation', queries: ['sidebar navigation', 'tabs interface', 'dropdown menu', 'map location picker'] },
  { id: 'modal', label: 'Modals', queries: ['modal dialog', 'tooltip popover'] },
  { id: 'empty-state', label: 'Empty / Error', queries: ['empty state', 'error page 404', 'success confirmation', 'status page incident'] },
  { id: 'notifications', label: 'Notifications', queries: ['notification toast'] },
  { id: 'chat', label: 'Chat / AI', queries: ['ai chat interface', 'chat messaging app', 'slack messaging'] },
  { id: 'docs', label: 'Docs / Help', queries: ['documentation site', 'help center support', 'email template web'] },
  { id: 'marketing', label: 'Marketing', queries: ['job board careers', 'marketplace listing'] },
  { id: 'mobile-apps', label: 'Mobile apps', queries: [
    'fintech wallet app', 'social feed app', 'ecommerce mobile', 'fitness health app',
    'food delivery app', 'music player app', 'travel booking app', 'dating app ui',
    'meditation wellness app', 'crypto trading app', 'real estate app', 'education learning app',
    'photo camera app', 'weather app', 'news reader app', 'parking mobility app',
  ] },
  { id: 'branding', label: 'Branding', queries: [
    'brand identity', 'logo design', 'poster typography', 'packaging design', 'editorial layout',
    'marketing visual', 'billboard campaign', 'business card', 'swag merchandise', 'event poster',
    'album cover art', 'book cover design',
  ] },
  { id: 'motion', label: 'Motion', queries: [
    'loading skeleton', 'animation transition', 'micro interaction', 'progress indicator',
    'video player ui', 'carousel slider', 'pull to refresh', 'skeleton shimmer', 'lottie animation ui', 'scroll reveal',
  ] },
  { id: 'product', label: 'Product UI', queries: [
    'minimal app ui', 'dark mode interface', 'b2b saas product', 'consumer mobile app',
    'design system components', 'notion style app', 'stripe dashboard', 'linear app ui',
    'revolut banking', 'spotify player', 'airbnb booking', 'shopify admin', 'figma design tool', 'vercel dashboard',
  ] },
];

const QUERY_TO_SCREEN = new Map();
for (const st of PIK_SCREEN_TYPES) {
  if (st.id === 'all') continue;
  for (const q of st.queries || []) {
    QUERY_TO_SCREEN.set(q.toLowerCase(), st.id);
  }
}

const SCREEN_LABEL = Object.fromEntries(PIK_SCREEN_TYPES.map((s) => [s.id, s.label]));

export function inferScreenType(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q || q === 'design-memory') return 'product';
  return QUERY_TO_SCREEN.get(q) || 'product';
}

export function screenTypeLabel(id) {
  return SCREEN_LABEL[id] || 'Экран';
}

export function querySlug(query) {
  return String(query || '').trim().toLowerCase().replace(/\s+/g, '-');
}

export function itemMatchesScreenType(item, screenTypeId) {
  const id = String(screenTypeId || 'all').toLowerCase();
  if (!id || id === 'all') return true;
  const itemType = item.screen_type || inferScreenType(item.query);
  if (itemType === id) return true;
  const slug = querySlug(item.query);
  const def = PIK_SCREEN_TYPES.find((s) => s.id === id);
  if (!def?.queries?.length) return false;
  return def.queries.some((q) => querySlug(q) === slug || item.query === q);
}

export function itemMatchesPlatform(item, platformId) {
  const id = String(platformId || 'all').toLowerCase();
  if (!id || id === 'all') return true;
  const p = String(item.platform || '').toLowerCase();
  if (id === 'ios') return p === 'ios';
  if (id === 'web') return p === 'web' || p !== 'ios';
  return true;
}

export function applyPikFilters(items, { topic = 'all', platform = 'all', screenType = 'all', q = '' } = {}) {
  const topicId = String(topic || 'all').toLowerCase();
  let list = items.slice();

  if (topicId && topicId !== 'all') {
    list = list.filter((item) => item.topic === topicId);
  }
  list = list.filter((item) => itemMatchesPlatform(item, platform));
  list = list.filter((item) => itemMatchesScreenType(item, screenType));

  const tokens = String(q || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (tokens.length) {
    list = list
      .map((item) => {
        const hay = [
          item.title,
          item.subtitle,
          item.screen_type_label,
          item.query,
          item.source,
          item.topic,
          item.platform,
          ...(item.tags || []),
        ].join(' ').toLowerCase();
        let score = 0;
        for (const t of tokens) {
          if (hay.includes(t)) score += 2;
        }
        return { item, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  } else {
    list.sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
  }

  return list;
}

export function computePikFacets(items, { topic = 'all', platform = 'all', screenType = 'all' } = {}) {
  const topicId = String(topic || 'all').toLowerCase();
  const platformId = String(platform || 'all').toLowerCase();
  const screenTypeId = String(screenType || 'all').toLowerCase();

  const platformCounts = { all: 0, web: 0, ios: 0 };
  const screenTypeCounts = { all: 0 };
  const topicCounts = { all: 0 };

  for (const st of PIK_SCREEN_TYPES) {
    if (st.id !== 'all') screenTypeCounts[st.id] = 0;
  }
  for (const t of ['all', 'ui', 'branding', 'mobile', 'web', 'motion']) {
    topicCounts[t] = 0;
  }

  for (const item of items) {
    topicCounts.all += 1;
    if (topicCounts[item.topic] != null) topicCounts[item.topic] += 1;

    if (topicId === 'all' || item.topic === topicId) {
      if (itemMatchesScreenType(item, screenTypeId)) {
        if (itemMatchesPlatform(item, 'web')) platformCounts.web += 1;
        if (itemMatchesPlatform(item, 'ios')) platformCounts.ios += 1;
        platformCounts.all += 1;
      }
      if (itemMatchesPlatform(item, platformId)) {
        screenTypeCounts.all += 1;
        const st = item.screen_type || inferScreenType(item.query);
        if (screenTypeCounts[st] != null) screenTypeCounts[st] += 1;
      }
    }
  }

  return { platformCounts, screenTypeCounts, topicCounts };
}
