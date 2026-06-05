/**
 * Сборка каталога PIK-FOLDER из Mobbin API (поиск по тематикам).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { MobbinService } from './mobbin-service.js';
import { enrichScreensWithPreviews } from './mobbin-preview.js';

export const PIK_TOPICS = [
  { id: 'all', label: 'Все' },
  { id: 'ui', label: 'UI' },
  { id: 'branding', label: 'Брендинг' },
  { id: 'mobile', label: 'Мобильное' },
  { id: 'web', label: 'Web' },
  { id: 'motion', label: 'Motion' },
];

/** Запросы Mobbin по тематикам (web + ios) */
export const PIK_MOBBIN_QUERIES = {
  ui: [
    'dashboard saas',
    'sidebar navigation',
    'settings page',
    'empty state',
    'data table',
    'modal dialog',
    'card grid',
    'form inputs',
    'charts analytics',
    'notification toast',
    'search results',
    'profile settings',
    'command palette',
    'kanban board',
    'file upload',
    'billing subscription',
    'team invite',
    'error page 404',
    'success confirmation',
    'filter sort ui',
    'tabs interface',
    'dropdown menu',
    'tooltip popover',
    'wizard stepper',
    'map location picker',
  ],
  branding: [
    'brand identity',
    'logo design',
    'poster typography',
    'packaging design',
    'editorial layout',
    'marketing visual',
    'billboard campaign',
    'business card',
    'swag merchandise',
    'event poster',
    'album cover art',
    'book cover design',
  ],
  mobile: [
    'onboarding flow',
    'fintech wallet app',
    'social feed app',
    'ecommerce mobile',
    'fitness health app',
    'chat messaging app',
    'food delivery app',
    'music player app',
    'travel booking app',
    'dating app ui',
    'meditation wellness app',
    'crypto trading app',
    'real estate app',
    'education learning app',
    'photo camera app',
    'weather app',
    'news reader app',
    'parking mobility app',
  ],
  web: [
    'saas landing page',
    'pricing page',
    'login sign in',
    'checkout payment',
    'ai chat interface',
    'documentation site',
    'crm dashboard',
    'analytics platform',
    'calendar scheduling',
    'file manager',
    'portfolio website',
    'blog article layout',
    'job board careers',
    'help center support',
    'status page incident',
    'marketplace listing',
    'admin panel',
    'email template web',
    'cookie consent banner',
    'referral program page',
  ],
  motion: [
    'loading skeleton',
    'animation transition',
    'micro interaction',
    'progress indicator',
    'video player ui',
    'carousel slider',
    'pull to refresh',
    'skeleton shimmer',
    'lottie animation ui',
    'scroll reveal',
  ],
  all: [
    'minimal app ui',
    'dark mode interface',
    'b2b saas product',
    'consumer mobile app',
    'design system components',
    'notion style app',
    'stripe dashboard',
    'linear app ui',
    'revolut banking',
    'spotify player',
    'airbnb booking',
    'shopify admin',
    'figma design tool',
    'slack messaging',
    'vercel dashboard',
  ],
};

const TOPIC_LABEL = Object.fromEntries(PIK_TOPICS.map((t) => [t.id, t.label]));

function defaultSize(platform) {
  if (platform === 'ios') return { width: 390, height: 844 };
  return { width: 520, height: 390 };
}

function inferTopicFromQuery(queryKey) {
  return queryKey in PIK_MOBBIN_QUERIES ? queryKey : 'all';
}

function tagsForItem({ topic, platform, query, appName }) {
  const base = ['mobbin', platform, topic, query.toLowerCase().replace(/\s+/g, '-')];
  const name = String(appName || '').toLowerCase();
  if (name) base.push(name.split(/\s+/)[0]);
  return [...new Set(base.filter(Boolean))].slice(0, 12);
}

/**
 * @param {ReturnType<MobbinService['searchScreens']> extends Promise<infer R> ? R : never} screen
 */
export function mobbinScreenToPikItem(screen, { topic, query, sortBase = 0 }) {
  if (!screen?.imageUrl && !screen?.url) return null;
  const platform = screen.platform === 'ios' ? 'ios' : 'web';
  const size = defaultSize(platform);
  const topicLabel = TOPIC_LABEL[topic] || topic;
  const appName = String(screen.title || 'Mobbin').trim();
  return {
    id: screen.id ? `mobbin-${screen.id}` : `mobbin-${sortBase}-${Date.now()}`,
    source: 'mobbin',
    title: appName,
    subtitle: `${topicLabel} · ${platform === 'ios' ? 'iOS' : 'Web'}`,
    image_url: screen.imageUrl || '',
    thumb_url: screen.imageUrl || '',
    external_url: screen.url || '',
    topic,
    platform,
    query,
    tags: tagsForItem({ topic, platform, query, appName }),
    width: size.width,
    height: size.height,
    is_video: false,
    sort_order: sortBase,
    mobbin_screen_id: screen.id || null,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeDesignRef(ref, index) {
  const url = String(ref.url || ref.mobbin_url || '').trim();
  if (!url) return null;
  const platform = ref.platform === 'ios' ? 'ios' : 'web';
  const size = defaultSize(platform);
  const tags = Array.isArray(ref.tags) ? ref.tags : [];
  let topic = 'ui';
  if (tags.some((t) => /fintech|wallet|ios|android|mobile|onboarding/i.test(t))) topic = 'mobile';
  else if (tags.some((t) => /landing|marketing|site|web|saas/i.test(t))) topic = 'web';
  else if (tags.some((t) => /brand|poster|logo/i.test(t))) topic = 'branding';
  return {
    id: `seed-${ref.id || index}`,
    source: 'mobbin',
    title: String(ref.title || 'Reference').trim(),
    subtitle: `${TOPIC_LABEL[topic]} · ${platform === 'ios' ? 'iOS' : 'Web'}`,
    image_url: ref.image_url || ref.imageUrl || '',
    thumb_url: ref.image_url || ref.imageUrl || '',
    external_url: url,
    topic,
    platform,
    query: 'design-memory',
    tags: ['mobbin', 'seed', platform, topic, ...tags].slice(0, 12),
    width: size.width,
    height: size.height,
    is_video: false,
    sort_order: 50 + index,
  };
}

/**
 * @param {object} opts
 * @param {MobbinService} opts.mobbinService
 * @param {string} [opts.designRefsPath]
 * @param {(msg: string) => void} [opts.onProgress]
 * @param {number} [opts.perQueryLimit]
 * @param {number} [opts.delayMs]
 */
export async function buildMobbinCatalog({
  mobbinService,
  designRefsPath,
  onProgress = () => {},
  perQueryLimit = 20,
  delayMs = 280,
} = {}) {
  if (!mobbinService?.isConfigured?.()) {
    throw new Error('Mobbin API key не настроен. Укажите ключ в Настройки → Konstancia → Mobbin.');
  }

  const byId = new Map();
  let sort = 10000;

  const addItem = (item) => {
    if (!item?.image_url && !item?.external_url) return;
    const key = item.mobbin_screen_id || item.id;
    if (!key || byId.has(key)) return;
    byId.set(key, item);
  };

  const pendingPreview = [];

  const ingestScreens = (screens, { topic, query }) => {
    for (const screen of screens || []) {
      if (!screen?.imageUrl && screen?.url) {
        pendingPreview.push({ ...screen, _topic: topic, _query: query });
        continue;
      }
      const item = mobbinScreenToPikItem(screen, { topic, query, sortBase: sort-- });
      if (item?.image_url) addItem(item);
    }
  };

  for (const [topic, queries] of Object.entries(PIK_MOBBIN_QUERIES)) {
    for (const query of queries) {
      for (const platform of ['web', 'ios']) {
        onProgress(`${TOPIC_LABEL[topic] || topic} · ${platform} · «${query}»`);
        const res = await mobbinService.searchScreens(query, {
          platform,
          limit: perQueryLimit,
          mode: 'deep',
          maxLimit: 30,
        });
        if (!res.ok) {
          onProgress(`  ⚠ ${res.message || 'ошибка'}`);
          await sleep(delayMs);
          continue;
        }
        ingestScreens(res.screens, { topic, query });

        const flowRes = await mobbinService.searchFlows(query, { platform, limit: 6 });
        if (flowRes.ok) {
          for (const flow of flowRes.flows || []) {
            for (const scr of flow.screens || []) {
              const url = scr.mobbinUrl || scr.url;
              if (!url && !scr.imageUrl) continue;
              ingestScreens([{
                id: `${flow.id}-${url || scr.imageUrl}`,
                title: flow.title,
                url,
                imageUrl: scr.imageUrl,
                platform: flow.platform || platform,
              }], { topic, query });
            }
          }
        }

        await sleep(delayMs);
      }
    }
  }

  if (pendingPreview.length) {
    const unique = [...new Map(pendingPreview.map((s) => [s.url, s])).values()].slice(0, 500);
    onProgress(`Превью для ${unique.length} экранов без картинки…`);
    const enriched = await enrichScreensWithPreviews(
      unique.map((s) => ({ url: s.url, mobbin_url: s.url, title: s.title, platform: s.platform, id: s.id })),
      { limit: unique.length },
    );
    const imgByUrl = new Map(
      enriched
        .filter((row) => row.imageUrl || row.image_url)
        .map((row) => [row.url || row.mobbin_url, row.imageUrl || row.image_url]),
    );
    for (const src of unique) {
      const imageUrl = imgByUrl.get(src.url);
      if (!imageUrl) continue;
      const item = mobbinScreenToPikItem(
        { ...src, imageUrl, url: src.url },
        { topic: src._topic || 'all', query: src._query || 'mobbin', sortBase: sort-- },
      );
      if (item?.image_url) addItem(item);
    }
  }

  if (designRefsPath && existsSync(designRefsPath)) {
    onProgress('Локальные design-references…');
    try {
      const seed = JSON.parse(readFileSync(designRefsPath, 'utf8'));
      const refs = Array.isArray(seed?.items) ? seed.items : [];
      const needPreview = refs.filter((r) => r.url && !r.image_url);
      const enriched = await enrichScreensWithPreviews(
        needPreview.map((r) => ({ mobbin_url: r.url, ...r })),
        { limit: refs.length },
      );
      const imgByUrl = new Map(enriched.map((e) => [e.mobbin_url || e.url, e.image_url || e.imageUrl]));
      refs.forEach((ref, i) => {
        const img = imgByUrl.get(ref.url) || ref.image_url;
        const item = normalizeDesignRef({ ...ref, image_url: img }, i);
        if (item?.external_url) {
          if (!item.image_url) return;
          addItem(item);
        }
      });
    } catch (err) {
      onProgress(`  ⚠ seed: ${err?.message || err}`);
    }
  }

  const items = [...byId.values()].sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
  return {
    version: 2,
    builtAt: new Date().toISOString(),
    topics: PIK_TOPICS,
    items,
    stats: {
      total: items.length,
      byTopic: PIK_TOPICS.reduce((acc, t) => {
        acc[t.id] = items.filter((it) => it.topic === t.id).length;
        return acc;
      }, {}),
    },
  };
}

export function loadMobbinCatalog(catalogPath) {
  if (!catalogPath || !existsSync(catalogPath)) {
    return { version: 2, topics: PIK_TOPICS, items: [], builtAt: null };
  }
  try {
    const parsed = JSON.parse(readFileSync(catalogPath, 'utf8'));
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return {
      version: parsed.version || 2,
      topics: Array.isArray(parsed.topics) && parsed.topics.length ? parsed.topics : PIK_TOPICS,
      items,
      builtAt: parsed.builtAt || null,
      stats: parsed.stats || null,
    };
  } catch {
    return { version: 2, topics: PIK_TOPICS, items: [], builtAt: null };
  }
}

export function saveMobbinCatalog(catalogPath, catalog) {
  const dir = path.dirname(catalogPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
}
