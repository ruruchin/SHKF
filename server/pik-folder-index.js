import { buildAppGroups, slugifyApp } from '../shared/pik-folder-apps.js';
import { computePikFacets } from '../shared/pik-folder-filters.js';

export function buildCatalogIndex(items) {
  const normalized = items || [];
  const byAppKey = new Map();

  for (const item of normalized) {
    const key = slugifyApp(item.title);
    if (!byAppKey.has(key)) byAppKey.set(key, []);
    byAppKey.get(key).push(item);
  }

  for (const screens of byAppKey.values()) {
    screens.sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
  }

  const appSummaries = buildAppGroups(normalized);
  const baseFacets = computePikFacets(normalized, { topic: 'all', platform: 'all', screenType: 'all' });

  return {
    byAppKey,
    appSummaries,
    baseFacets,
    total: normalized.length,
    appTotal: appSummaries.length,
  };
}

export function filterCacheKey(filters) {
  return [
    filters.topic || 'all',
    filters.platform || 'all',
    filters.screenType || 'all',
    String(filters.q || '').trim().toLowerCase(),
  ].join('|');
}
