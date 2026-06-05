/** Группировка экранов PIK-FOLDER по приложению (как Mobbin). */

const DOMAIN_OVERRIDES = {
  'stripe dashboard': 'stripe.com',
  'linear mobile': 'linear.app',
  'notion': 'notion.so',
  'vercel': 'vercel.com',
  'shopify': 'shopify.com',
  'airbnb': 'airbnb.com',
  'spotify': 'spotify.com',
  'slack': 'slack.com',
  'figma': 'figma.com',
  'revolut': 'revolut.com',
  'canva': 'canva.com',
  'linear': 'linear.app',
  'craft': 'craft.do',
  'behance': 'behance.net',
  'squarespace': 'squarespace.com',
  'transit': 'transitapp.com',
  'google gemini': 'gemini.google.com',
  'openai': 'openai.com',
  'chatgpt': 'openai.com',
  'anthropic': 'anthropic.com',
  'claude': 'claude.ai',
  'perplexity': 'perplexity.ai',
  'microsoft copilot': 'copilot.microsoft.com',
  'copilot': 'copilot.microsoft.com',
};

export function slugifyApp(title) {
  return String(title || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

export function guessAppDomain(title) {
  const key = String(title || '').trim().toLowerCase();
  if (DOMAIN_OVERRIDES[key]) return DOMAIN_OVERRIDES[key];
  const slug = key.replace(/[^a-z0-9]/gi, '');
  if (!slug) return null;
  return `${slug}.com`;
}

export function appLogoCandidates(title) {
  const domain = guessAppDomain(title);
  if (!domain) return [];
  return [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://${domain}/apple-touch-icon.png`,
    `https://${domain}/favicon.ico`,
  ];
}

export function appLogoUrl(title) {
  const [first] = appLogoCandidates(title);
  return first || null;
}

export function appInitials(title) {
  const parts = String(title || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(parts[0] || '?').slice(0, 2).toUpperCase();
}

export function appAccentColor(title) {
  const str = String(title || 'app');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 62% 42%)`;
}

function inferMobbinAppUrl(screens) {
  for (const s of screens || []) {
    const url = String(s.external_url || '').trim();
    const appMatch = url.match(/mobbin\.com\/apps\/([^/?#]+)/i);
    if (appMatch) return `https://mobbin.com/apps/${appMatch[1]}`;
  }
  const first = screens?.[0]?.external_url;
  if (first && /mobbin\.com\/screens\//i.test(first)) {
    return first;
  }
  return '';
}

export function buildAppGroups(items) {
  const map = new Map();

  for (const item of items || []) {
    const title = String(item.title || 'Unknown').trim() || 'Unknown';
    const key = slugifyApp(title);
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        title,
        platforms: new Set(),
        topics: new Set(),
        screen_types: new Set(),
        screens: [],
        sort_order: Number(item.sort_order) || 0,
      });
    }
    const group = map.get(key);
    group.screens.push(item);
    group.platforms.add(String(item.platform || 'web').toLowerCase());
    group.topics.add(String(item.topic || 'all').toLowerCase());
    group.screen_types.add(String(item.screen_type || 'product').toLowerCase());
    group.sort_order = Math.max(group.sort_order, Number(item.sort_order) || 0);
  }

  return [...map.values()]
    .map((group) => {
      const screens = group.screens.slice().sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
      const platforms = [...group.platforms];
      let platform = 'web';
      if (platforms.includes('ios') && platforms.includes('web')) platform = 'both';
      else if (platforms.includes('ios')) platform = 'ios';

      return {
        id: group.id,
        title: group.title,
        screen_count: screens.length,
        platform,
        platforms,
        topics: [...group.topics],
        screen_types: [...group.screen_types],
        logo_url: appLogoUrl(group.title),
        logo_candidates: appLogoCandidates(group.title),
        accent: appAccentColor(group.title),
        initials: appInitials(group.title),
        cover_url: screens[0]?.thumb_url || screens[0]?.image_url || '',
        previews: screens.slice(0, 4).map((s) => s.thumb_url || s.image_url).filter(Boolean),
        mobbin_url: inferMobbinAppUrl(screens),
        sort_order: group.sort_order,
      };
    })
    .sort((a, b) => (b.sort_order - a.sort_order) || (b.screen_count - a.screen_count));
}

export function paginateApps(groups, { limit = 24, offset = 0 } = {}) {
  const cap = Math.max(1, Math.min(80, Number(limit) || 24));
  const off = Math.max(0, Number(offset) || 0);
  const slice = groups.slice(off, off + cap);
  return {
    apps: slice,
    total: groups.length,
    hasMore: off + slice.length < groups.length,
  };
}

export function screensForApp(items, appKey) {
  const key = String(appKey || '').toLowerCase();
  return (items || []).filter((item) => slugifyApp(item.title) === key);
}

export function filterAppSummaries(summaries, { topic = 'all', platform = 'all', screenType = 'all', q = '' } = {}) {
  const topicId = String(topic || 'all').toLowerCase();
  const platformId = String(platform || 'all').toLowerCase();
  const screenTypeId = String(screenType || 'all').toLowerCase();
  const tokens = String(q || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  return (summaries || []).filter((app) => {
    if (topicId !== 'all' && !app.topics?.includes(topicId)) return false;
    if (platformId === 'ios' && !app.platforms?.includes('ios')) return false;
    if (platformId === 'web' && !app.platforms?.includes('web')) return false;
    if (screenTypeId !== 'all' && !app.screen_types?.includes(screenTypeId)) return false;
    if (tokens.length) {
      const hay = [app.title, ...(app.topics || []), ...(app.screen_types || [])].join(' ').toLowerCase();
      if (!tokens.some((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

export function appSummaryForKey(summaries, appKey) {
  const key = String(appKey || '').toLowerCase();
  return (summaries || []).find((a) => a.id === key) || null;
}
