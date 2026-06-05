import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import {
  PIK_TOPICS,
  buildMobbinCatalog,
  loadMobbinCatalog,
  saveMobbinCatalog,
} from './pik-folder-mobbin-catalog.js';
import {
  PIK_PLATFORMS,
  PIK_SCREEN_TYPES,
  applyPikFilters,
  computePikFacets,
  inferScreenType,
  screenTypeLabel,
} from '../shared/pik-folder-filters.js';
import {
  appSummaryForKey,
  filterAppSummaries,
  paginateApps,
} from '../shared/pik-folder-apps.js';
import {
  buildCatalogIndex,
  filterCacheKey,
} from './pik-folder-index.js';

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const imageUrl = String(raw.image_url || raw.imageUrl || '').trim();
  if (!imageUrl) return null;
  const w = Math.max(200, Math.min(1200, Number(raw.width || 400)));
  const h = Math.max(200, Math.min(1600, Number(raw.height || 500)));
  const tags = Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [];
  let platform = String(raw.platform || '').trim().toLowerCase();
  if (!platform && tags.includes('ios')) platform = 'ios';
  if (!platform) platform = 'web';
  const topic = String(raw.topic || 'all').trim().toLowerCase() || 'all';
  const title = String(raw.title || 'Reference').trim() || 'Reference';
  const query = String(raw.query || '').trim();
  const screenType = String(raw.screen_type || inferScreenType(query)).trim().toLowerCase() || 'product';
  const stLabel = screenTypeLabel(screenType);
  const platLabel = platform === 'ios' ? 'iOS' : 'Web';
  const subtitle = String(raw.subtitle || '').trim() || `${stLabel} · ${platLabel}`;
  return {
    id: String(raw.id || `pik-${Date.now()}`),
    source: String(raw.source || 'mobbin').trim().toLowerCase(),
    title,
    subtitle,
    image_url: imageUrl,
    thumb_url: String(raw.thumb_url || raw.thumbUrl || imageUrl).trim() || imageUrl,
    external_url: String(raw.external_url || raw.externalUrl || raw.url || '').trim(),
    topic,
    platform,
    query,
    screen_type: screenType,
    screen_type_label: stLabel,
    tags,
    width: w,
    height: h,
    is_video: !!raw.is_video || !!raw.isVideo,
    sort_order: Number(raw.sort_order ?? raw.sortOrder ?? 0),
    created_at: raw.created_at || raw.createdAt || null,
  };
}

export class PikFolderService {
  constructor(seedPath, deps = {}) {
    this.seedPath = seedPath;
    this.mobbinCatalogPath = deps.mobbinCatalogPath || null;
    this.mobbinService = deps.mobbinService || null;
    this.designRefsPath = deps.designRefsPath || null;
    this.getMobbinSettings = deps.getMobbinSettings || (() => ({}));
    this.authService = deps.authService || null;
    this.mobbinCatalog = { topics: PIK_TOPICS, items: [], builtAt: null };
    this._catalogMtime = 0;
    this._index = null;
    this._legacyItems = [];
    this._filterCache = new Map();
    this._remoteCountCache = { at: 0, count: 0 };
    this._syncScheduled = false;
    this.reloadMobbinCatalog(true);
    this._reloadLegacySeed();
  }

  reload() {
    this.reloadMobbinCatalog(true);
    this._reloadLegacySeed();
    this._remoteCountCache.at = 0;
    this._filterCache.clear();
  }

  _rebuildIndex(items, builtAt) {
    this._index = {
      ...buildCatalogIndex(items),
      allItems: items,
      builtAt: builtAt || null,
    };
    this._filterCache.clear();
  }

  reloadMobbinCatalog(force = false) {
    if (!this.mobbinCatalogPath || !existsSync(this.mobbinCatalogPath)) {
      this.mobbinCatalog = { topics: PIK_TOPICS, items: [], builtAt: null };
      this._index = this._legacyItems.length
        ? { ...buildCatalogIndex(this._legacyItems), allItems: this._legacyItems, builtAt: null }
        : null;
      this._catalogMtime = 0;
      return;
    }
    try {
      const mtime = statSync(this.mobbinCatalogPath).mtimeMs;
      if (!force && mtime === this._catalogMtime && this._index?.total) {
        return;
      }
      this.mobbinCatalog = loadMobbinCatalog(this.mobbinCatalogPath);
      this._catalogMtime = mtime;
      const items = (this.mobbinCatalog.items || []).map(normalizeItem).filter(Boolean);
      this._rebuildIndex(items, this.mobbinCatalog.builtAt);
    } catch {
      this.mobbinCatalog = { topics: PIK_TOPICS, items: [], builtAt: null };
      this._index = null;
    }
  }

  _reloadLegacySeed() {
    this._legacyItems = [];
    if (!this.seedPath || !existsSync(this.seedPath)) return;
    try {
      const parsed = JSON.parse(readFileSync(this.seedPath, 'utf8'));
      this._legacyItems = (parsed?.items || []).map(normalizeItem).filter(Boolean);
      if (!this._index?.total && this._legacyItems.length) {
        this._rebuildIndex(this._legacyItems, null);
      }
    } catch {
      this._legacyItems = [];
    }
  }

  getTopics() {
    return (this.mobbinCatalog.topics?.length ? this.mobbinCatalog.topics : PIK_TOPICS).slice();
  }

  getCatalogItems() {
    return this._index?.allItems?.length ? this._index.allItems : this._legacyItems.slice();
  }

  isReady() {
    return !!(this._index?.total);
  }

  _getIndex() {
    this.reloadMobbinCatalog();
    if (this._index?.total) return this._index;
    if (this._legacyItems.length) {
      this._rebuildIndex(this._legacyItems, null);
      return this._index;
    }
    return null;
  }

  _getFiltered(filters) {
    const index = this._getIndex();
    if (!index) {
      return {
        index: null,
        apps: [],
        items: [],
        facets: { topicCounts: {}, platformCounts: {}, screenTypeCounts: {} },
        appTotal: 0,
        itemTotal: 0,
      };
    }

    const key = filterCacheKey(filters);
    if (this._filterCache.has(key)) {
      return { index, ...this._filterCache.get(key) };
    }

    const topic = filters.topic || 'all';
    const platform = filters.platform || 'all';
    const screenType = filters.screenType || 'all';
    const q = filters.q || '';

    const apps = filterAppSummaries(index.appSummaries, { topic, platform, screenType, q });
    let items = index.allItems;
    let facets = index.baseFacets;

    if (topic !== 'all' || platform !== 'all' || screenType !== 'all' || q) {
      items = applyPikFilters(index.allItems, { topic, platform, screenType, q });
      facets = computePikFacets(index.allItems, { topic, platform, screenType });
    }

    const result = { apps, items, facets, appTotal: apps.length, itemTotal: items.length };
    this._filterCache.set(key, result);
    if (this._filterCache.size > 48) {
      this._filterCache.delete(this._filterCache.keys().next().value);
    }
    return { index, ...result };
  }

  _supabaseReady() {
    return !!(this.authService?.client && this.authService?.session?.access_token);
  }

  async getRemoteCount({ fresh = false } = {}) {
    if (!this._supabaseReady()) return 0;
    const now = Date.now();
    if (!fresh && now - this._remoteCountCache.at < 60_000) {
      return this._remoteCountCache.count;
    }
    const { count, error } = await this.authService.client
      .from('pik_folder_items')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    const n = count || 0;
    this._remoteCountCache = { at: now, count: n };
    return n;
  }

  async remoteStatus() {
    const localTotal = this.getCatalogItems().length;
    try {
      const remoteCount = await this.getRemoteCount();
      return {
        dbReady: this._supabaseReady(),
        remoteCount,
        localTotal,
        synced: remoteCount >= Math.min(localTotal, 100) && remoteCount >= localTotal * 0.85,
        builtAt: this._index?.builtAt || null,
      };
    } catch (err) {
      return {
        dbReady: this._supabaseReady(),
        remoteCount: 0,
        localTotal,
        synced: false,
        error: err?.message || String(err),
      };
    }
  }

  getAppScreens(payload = {}) {
    const appKey = String(payload.appKey || '').trim().toLowerCase();
    const index = this._getIndex();
    if (!index || !appKey) return { items: [], app: null };

    const filters = {
      topic: payload.topic || 'all',
      platform: payload.platform || 'all',
      screenType: payload.screenType || 'all',
      q: '',
    };

    let screens = index.byAppKey.get(appKey) || [];
    if (filters.platform !== 'all' || filters.screenType !== 'all' || filters.topic !== 'all') {
      screens = applyPikFilters(screens, filters);
    }

    const app = appSummaryForKey(index.appSummaries, appKey);
    return {
      items: screens,
      app: app ? {
        id: app.id,
        title: app.title,
        screen_count: screens.length,
        platform: app.platform,
        topics: app.topics,
        screen_types: app.screen_types,
        accent: app.accent,
        initials: app.initials,
        logo_url: app.logo_url,
        logo_candidates: app.logo_candidates,
      } : null,
    };
  }

  async list(payload = {}) {
    const filters = {
      topic: payload.topic || 'all',
      platform: payload.platform || 'all',
      screenType: payload.screenType || 'all',
      q: payload.q || '',
    };
    const appKey = String(payload.appKey || '').trim().toLowerCase();
    const view = payload.view || (appKey ? 'screens' : 'apps');
    const limit = Math.max(1, Math.min(80, Number(payload.limit) || (view === 'apps' ? 24 : 48)));
    const offset = Math.max(0, Number(payload.offset) || 0);
    const includeFacets = offset === 0;

    const { index, apps, items, facets, appTotal, itemTotal } = this._getFiltered(filters);
    const cachedFacets = this._filterCache.get(filterCacheKey(filters))?.facets || facets;

    const base = {
      topics: this.getTopics(),
      platforms: PIK_PLATFORMS,
      screenTypes: PIK_SCREEN_TYPES,
      source: 'local',
      catalogTotal: index?.total || 0,
      appTotal: appTotal ?? index?.appTotal ?? 0,
      topicCounts: (includeFacets ? facets : cachedFacets).topicCounts,
      platformCounts: (includeFacets ? facets : cachedFacets).platformCounts,
      screenTypeCounts: (includeFacets ? facets : cachedFacets).screenTypeCounts,
      builtAt: index?.builtAt || null,
    };

    if (!index) {
      return { view: 'apps', apps: [], items: [], total: 0, hasMore: false, ...base, offset, limit };
    }

    // На главном экране всегда группировка по приложениям, не плоский список скринов.
    if (!appKey) {
      const page = paginateApps(apps, { limit, offset });
      return {
        view: 'apps',
        apps: page.apps,
        items: [],
        total: page.total,
        hasMore: page.hasMore,
        ...base,
        offset,
        limit,
      };
    }

    let screens = index.byAppKey.get(appKey) || [];
    screens = applyPikFilters(screens, { ...filters, q: '' });

    const off = Math.max(0, offset);
    const slice = screens.slice(off, off + limit);
    const app = appSummaryForKey(index.appSummaries, appKey);

    return {
      view: 'screens',
      apps: [],
      items: slice,
      total: screens.length,
      hasMore: off + slice.length < screens.length,
      ...base,
      offset: off,
      limit,
      app: app ? {
        id: app.id,
        title: app.title,
        screen_count: screens.length,
        platform: app.platform,
        topics: app.topics,
        screen_types: app.screen_types,
        accent: app.accent,
        initials: app.initials,
        logo_url: app.logo_url,
        logo_candidates: app.logo_candidates,
      } : null,
    };
  }

  _scheduleBackgroundSync() {
    if (this._syncScheduled) return;
    this._syncScheduled = true;
    setTimeout(() => this._maybeSyncToDatabase(), 45_000);
  }

  _maybeSyncToDatabase() {
    if (!this._supabaseReady() || !this._index?.total) return;
    (async () => {
      try {
        const remote = await this.getRemoteCount();
        if (remote >= this._index.total * 0.9) return;
        await this.syncSeedToDatabase();
      } catch (err) {
        console.warn('[pik-folder] background sync:', err?.message || err);
      }
    })();
  }

  async syncMobbinCatalog(onProgress) {
    if (this.mobbinService) {
      this.mobbinService.configure(this.getMobbinSettings());
    }
    const catalog = await buildMobbinCatalog({
      mobbinService: this.mobbinService,
      designRefsPath: this.designRefsPath,
      onProgress: onProgress || (() => {}),
      perQueryLimit: 28,
      delayMs: 220,
    });
    if (this.mobbinCatalogPath) {
      saveMobbinCatalog(this.mobbinCatalogPath, catalog);
      this.mobbinCatalog = catalog;
      const items = (catalog.items || []).map(normalizeItem).filter(Boolean);
      this._rebuildIndex(items, catalog.builtAt);
      this._catalogMtime = statSync(this.mobbinCatalogPath).mtimeMs;
      this._remoteCountCache.at = 0;
    }
    return { ok: true, count: catalog.items.length, builtAt: catalog.builtAt, stats: catalog.stats };
  }

  async syncSeedToDatabase(onProgress) {
    const client = this.authService?.client;
    const session = this.authService?.session;
    if (!client || !session?.access_token) {
      throw new Error('Нужен вход в Supabase для загрузки референсов в БД.');
    }

    this.reloadMobbinCatalog();
    const rows = this.getCatalogItems().map((item) => ({
      id: item.id,
      source: item.source,
      title: item.title,
      image_url: item.image_url,
      thumb_url: item.thumb_url,
      external_url: item.external_url,
      topic: item.topic,
      platform: item.platform,
      screen_type: item.screen_type,
      query: item.query || '',
      tags: item.tags,
      width: item.width,
      height: item.height,
      is_video: item.is_video,
      sort_order: item.sort_order,
    }));

    const batchSize = 120;
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const { error } = await client.from('pik_folder_items').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
      onProgress?.({
        message: `В базу: ${Math.min(i + chunk.length, rows.length)} / ${rows.length}`,
        done: Math.min(i + chunk.length, rows.length),
        total: rows.length,
      });
    }

    this._remoteCountCache = { at: Date.now(), count: rows.length };
    return { count: rows.length };
  }

  writeLegacySeed(catalog) {
    if (!this.seedPath) return;
    writeFileSync(this.seedPath, JSON.stringify({
      version: 2,
      topics: catalog.topics,
      items: catalog.items,
    }, null, 2), 'utf8');
  }
}
