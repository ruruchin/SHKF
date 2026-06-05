(function () {
  const APP_PAGE_SIZE = 24;
  const SCREEN_PAGE_SIZE = 48;

  let state = {
    view: 'apps',
    appKey: '',
    appMeta: null,
    topic: 'all',
    platform: 'all',
    screenType: 'all',
    q: '',
    items: [],
    apps: [],
    appsSnapshot: [],
    topics: [],
    platforms: [],
    screenTypes: [],
    loading: false,
    loadingMore: false,
    hasMore: true,
    offset: 0,
    cols: 5,
    source: 'local',
    topicCounts: null,
    platformCounts: null,
    screenTypeCounts: null,
    viewerItems: [],
    viewerIndex: 0,
    viewerPlaylistKey: '',
  };

  let searchTimer = null;
  let resizeObserver = null;
  let scrollBound = false;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sourceLabel(source) {
    const map = {
      mobbin: 'Mobbin',
      supabase: 'База',
      local: 'Кэш',
      legacy: 'Кэш',
      pinterest: 'Pinterest',
      savee: 'Savee',
      manual: 'Manual',
    };
    return map[String(source || '').toLowerCase()] || source || 'Ref';
  }

  function mediaUrl(url) {
    const base = String(url || '').trim();
    if (!base) return '';
    // Подписанные Mobbin CDN URL нельзя менять — ломается enc=
    if (/[?&]enc=/i.test(base)) return base;
    return base;
  }

  function thumbSrc(url) {
    return mediaUrl(url);
  }

  const imageProxyCache = new Map();
  let imageProxyInflight = 0;
  const IMAGE_PROXY_MAX = 6;

  async function fetchImageProxy(url) {
    const normalized = mediaUrl(String(url || '').trim());
    if (!normalized) return null;
    if (imageProxyCache.has(normalized)) return imageProxyCache.get(normalized);
    if (!window.api?.pikFolderFetchImage) return null;
    while (imageProxyInflight >= IMAGE_PROXY_MAX) {
      await new Promise((r) => setTimeout(r, 40));
    }
    imageProxyInflight += 1;
    try {
      const dataUrl = await window.api.pikFolderFetchImage({ url: normalized });
      if (dataUrl) imageProxyCache.set(normalized, dataUrl);
      return dataUrl || null;
    } catch {
      return null;
    } finally {
      imageProxyInflight -= 1;
    }
  }

  function viewerImageDataUrl() {
    const img = $('pik-viewer-stage')?.querySelector('.pik-viewer-img');
    if (!img || !img.naturalWidth) return null;
    if (img.dataset.dataUrl) return img.dataset.dataUrl;
    if (img.src?.startsWith('data:')) return img.src;
    return null;
  }

  async function hydrateImage(img, rawUrl) {
    const url = mediaUrl(rawUrl);
    if (!url || !img) return;
    img.dataset.rawSrc = url;
    img.referrerPolicy = 'no-referrer';
    img.src = url;

    img.addEventListener('error', async () => {
      if (img.dataset.proxyTried) return;
      img.dataset.proxyTried = '1';
      const dataUrl = await fetchImageProxy(url);
      if (dataUrl) {
        img.src = dataUrl;
        markImageLoaded(img);
      }
    }, { once: true });

    img.addEventListener('load', () => markImageLoaded(img), { once: true });
    if (img.complete && img.naturalWidth) markImageLoaded(img);
  }

  function markImageLoaded(img) {
    img.closest('.pik-app-card')?.classList.add('is-loaded');
    img.closest('.pik-card')?.classList.add('is-loaded');
    img.closest('.pik-screen-card')?.classList.add('is-loaded');
    const frame = img.closest('.pik-viewer-frame');
    if (frame) {
      frame.classList.add('is-loaded');
      img.classList.add('is-visible');
      frame.querySelector('.pik-viewer-loading')?.remove();
    }
  }

  async function hydrateViewerImage(img, rawUrl, { onLoad, onFail } = {}) {
    const url = mediaUrl(rawUrl);
    if (!url || !img) return;
    img.dataset.rawSrc = url;
    img.referrerPolicy = 'no-referrer';

    const finish = (dataUrl) => {
      if (dataUrl) img.dataset.dataUrl = dataUrl;
      markImageLoaded(img);
      onLoad?.();
    };

    const mobbinCdn = /mobbin\.com|bytescale/i.test(url);
    if (mobbinCdn && window.api?.pikFolderFetchImage) {
      const dataUrl = await fetchImageProxy(url);
      if (dataUrl) {
        img.src = dataUrl;
        finish(dataUrl);
        return;
      }
    }

    img.addEventListener('load', () => finish(), { once: true });
    img.addEventListener('error', async () => {
      if (!img.dataset.proxyTried && window.api?.pikFolderFetchImage) {
        img.dataset.proxyTried = '1';
        const dataUrl = await fetchImageProxy(url);
        if (dataUrl) {
          img.src = dataUrl;
          finish(dataUrl);
          return;
        }
      }
      onFail?.();
    }, { once: true });
    img.src = url;
    if (img.complete && img.naturalWidth) finish();
  }

  const LOGO_DOMAIN_OVERRIDES = {
    squarespace: 'squarespace.com',
    'google gemini': 'gemini.google.com',
    stripe: 'stripe.com',
    notion: 'notion.so',
    vercel: 'vercel.com',
    shopify: 'shopify.com',
    figma: 'figma.com',
    revolut: 'revolut.com',
    linear: 'linear.app',
    openai: 'openai.com',
    chatgpt: 'openai.com',
    claude: 'claude.ai',
    perplexity: 'perplexity.ai',
  };

  function guessLogoDomain(title) {
    const key = String(title || '').trim().toLowerCase();
    if (LOGO_DOMAIN_OVERRIDES[key]) return LOGO_DOMAIN_OVERRIDES[key];
    const slug = key.replace(/[^a-z0-9]/gi, '');
    return slug ? `${slug}.com` : null;
  }

  function buildLogoCandidates(title) {
    const domain = guessLogoDomain(title);
    if (!domain) return [];
    return [
      `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://${domain}/apple-touch-icon.png`,
      `https://${domain}/favicon.ico`,
    ];
  }

  function logoCandidatesForApp(app) {
    const fresh = buildLogoCandidates(app?.title);
    const fromServer = [
      app?.logo_url,
      ...(Array.isArray(app?.logo_candidates) ? app.logo_candidates : []),
    ]
      .map((u) => String(u || '').trim())
      .filter(Boolean)
      .filter((u) => !/logo\.clearbit\.com|unavatar\.io/i.test(u));
    return [...new Set([...fresh, ...fromServer])];
  }

  function emblemHtml(app, className = 'pik-app-emblem') {
    const initials = escapeHtml(app.initials || app.title?.slice(0, 2) || '?');
    const accent = escapeHtml(app.accent || '#0a0a0a');
    const unique = logoCandidatesForApp(app);
    if (unique.length) {
      return `<span class="${className}" style="--pik-accent:${accent}">
        <img class="pik-app-emblem-img" data-logo-candidates="${escapeHtml(unique.join('|'))}" alt="" decoding="async" referrerpolicy="no-referrer" />
        <span class="pik-app-emblem-fallback pik-app-emblem--initials">${initials}</span>
      </span>`;
    }
    return `<span class="${className} pik-app-emblem--initials" style="--pik-accent:${accent}">${initials}</span>`;
  }

  function waitForLogoImg(img) {
    return new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve(true);
        return;
      }
      const done = (ok) => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
        resolve(ok);
      };
      const onLoad = () => done(img.naturalWidth > 0);
      const onError = () => done(false);
      img.addEventListener('load', onLoad, { once: true });
      img.addEventListener('error', onError, { once: true });
    });
  }

  async function hydrateEmblemLogo(img) {
    if (!img || img.dataset.logoBound) return;
    img.dataset.logoBound = '1';
    const candidates = String(img.dataset.logoCandidates || '').split('|').map((u) => u.trim()).filter(Boolean);
    if (!candidates.length) return;
    const emblem = img.closest('.pik-app-emblem');

    for (const url of candidates) {
      let src = null;
      if (window.api?.pikFolderFetchImage) {
        src = await fetchImageProxy(url);
      }
      if (!src) src = url;
      img.referrerPolicy = 'no-referrer';
      img.src = src;
      const ok = await waitForLogoImg(img);
      if (ok) {
        emblem?.classList.add('is-logo-loaded');
        return;
      }
    }

    img.style.display = 'none';
    emblem?.classList.remove('is-logo-loaded');
  }

  function bindEmblems(root = document) {
    root.querySelectorAll('.pik-app-emblem-img[data-logo-candidates]').forEach(hydrateEmblemLogo);
  }
  function resolveImageSrc(item) {
    const w = Math.round(Number(item.width) || 480);
    const h = Math.round(Number(item.height) || 360);
    const base = mediaUrl(item.thumb_url || item.image_url);
    if (!base) return '';

    if (base.includes('picsum.photos/')) {
      return base.replace(/\/\d+\/\d+(\?|$)/, `/${w}/${h}$1`);
    }

    if (base.includes('images.unsplash.com')) {
      const u = new URL(base.split('?')[0]);
      return `${u.origin}${u.pathname}?w=${w}&h=${h}&fit=crop&q=82&auto=format`;
    }

    if (base.includes('images.pexels.com')) {
      return `${base.split('?')[0]}?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;
    }

    return base;
  }

  function updateCols() {
    if (state.appKey) return;
    const scroll = $('pik-scroll');
    if (!scroll) return;
    const w = scroll.clientWidth;
    let cols = 6;
    if (w < 560) cols = 2;
    else if (w < 900) cols = 3;
    else if (w < 1200) cols = 4;
    else if (w < 1500) cols = 5;
    state.cols = cols;
    const masonry = $('pik-masonry');
    if (masonry) masonry.dataset.cols = String(cols);
  }

  function chipSuffix(counts, id) {
    const n = counts?.[id];
    return typeof n === 'number' && n > 0 ? ` · ${n}` : '';
  }

  function ensureAppsAtRoot() {
    if (!state.appKey) {
      state.view = 'apps';
      state.appMeta = null;
    }
  }

  function renderPlatforms() {
    const row = $('pik-platforms');
    if (!row) return;
    const platforms = state.platforms.length ? state.platforms : [
      { id: 'all', label: 'Все' },
      { id: 'web', label: 'Web' },
      { id: 'ios', label: 'iOS' },
    ];
    row.innerHTML = platforms.map((p) => `
      <button type="button" class="pik-chip pik-chip--platform${p.id === state.platform ? ' is-active' : ''}" data-platform="${escapeHtml(p.id)}">
        ${escapeHtml(p.label || p.id)}${chipSuffix(state.platformCounts, p.id)}
      </button>
    `).join('');
    row.querySelectorAll('[data-platform]').forEach((btn) => {
      btn.onclick = () => {
        state.platform = btn.dataset.platform || 'all';
        if (state.view === 'screens' && !state.appKey) {
          state.view = 'apps';
          state.appMeta = null;
        }
        state.offset = 0;
        renderPlatforms();
        renderTopics();
        renderScreenTypes();
        loadItems({ reset: true });
      };
    });
  }

  function renderTopics() {
    const row = $('pik-topics');
    if (!row) return;
    const topics = state.topics.length ? state.topics : [{ id: 'all', label: 'Все' }];
    row.innerHTML = topics.map((t) => `
      <button type="button" class="pik-topic${t.id === state.topic ? ' is-active' : ''}" data-topic="${escapeHtml(t.id)}">
        ${escapeHtml(t.label || t.id)}${chipSuffix(state.topicCounts, t.id)}
      </button>
    `).join('');

    row.querySelectorAll('.pik-topic').forEach((btn) => {
      btn.onclick = () => {
        state.topic = btn.dataset.topic || 'all';
        if (state.view === 'screens' && !state.appKey) {
          state.view = 'apps';
          state.appKey = '';
          state.appMeta = null;
        }
        state.offset = 0;
        renderTopics();
        renderPlatforms();
        renderScreenTypes();
        loadItems({ reset: true });
      };
    });
  }

  function renderScreenTypes() {
    const row = $('pik-screen-types');
    if (!row) return;
    const types = state.screenTypes.length ? state.screenTypes : [{ id: 'all', label: 'Все экраны' }];
    row.innerHTML = types.map((t) => {
      const n = state.screenTypeCounts?.[t.id];
      if (t.id !== 'all' && typeof n === 'number' && n === 0) return '';
      return `
      <button type="button" class="pik-chip${t.id === state.screenType ? ' is-active' : ''}" data-screen-type="${escapeHtml(t.id)}">
        ${escapeHtml(t.label || t.id)}${chipSuffix(state.screenTypeCounts, t.id)}
      </button>
    `;
    }).join('');

    row.querySelectorAll('[data-screen-type]').forEach((btn) => {
      btn.onclick = () => {
        state.screenType = btn.dataset.screenType || 'all';
        if (state.view === 'screens' && !state.appKey) {
          state.view = 'apps';
          state.appKey = '';
          state.appMeta = null;
        }
        state.offset = 0;
        renderScreenTypes();
        renderPlatforms();
        renderTopics();
        loadItems({ reset: true });
      };
    });
  }

  function topicLabel(topicId) {
    const t = state.topics.find((x) => x.id === topicId);
    return t?.label || topicId || 'UI';
  }

  function toggleCompanyChrome(on) {
    $('pik-filters')?.classList.toggle('hidden', !!on);
    $('pik-app-bar')?.classList.toggle('hidden', !on);
    $('pik-scroll')?.classList.toggle('pik-scroll--company', !!on);
    $('pik-app')?.classList.toggle('pik-app--company', !!on);
  }

  function screenTypeLabel(id) {
    const t = state.screenTypes.find((x) => x.id === id);
    return t?.label || id || 'UI';
  }

  function renderCompanyTabs(app) {
    const nav = $('pik-company-tabs');
    if (!nav || !app) return;
    const appTypes = new Set((app.screen_types || []).filter((t) => t && t !== 'all'));
    const tabs = [{ id: 'all', label: 'Все экраны' }];
    for (const st of state.screenTypes) {
      if (st.id === 'all') continue;
      if (appTypes.has(st.id)) tabs.push({ id: st.id, label: st.label || st.id });
    }
    if (tabs.length <= 1) {
      nav.classList.add('hidden');
      nav.innerHTML = '';
      return;
    }
    nav.classList.remove('hidden');
    nav.innerHTML = tabs.map((tab) => `
      <button type="button" class="pik-company-tab${tab.id === state.screenType ? ' is-active' : ''}" data-company-tab="${escapeHtml(tab.id)}">
        ${escapeHtml(tab.label)}
      </button>
    `).join('');
    nav.querySelectorAll('[data-company-tab]').forEach((btn) => {
      btn.onclick = () => {
        state.screenType = btn.dataset.companyTab || 'all';
        state.offset = 0;
        renderCompanyTabs(app);
        loadItems({ reset: true });
      };
    });
  }

  function renderCompanyHero(app) {
    const hero = $('pik-company-hero');
    if (!hero) return;
    if (!app || state.view !== 'screens' || !state.appKey) {
      hero.classList.add('hidden');
      hero.innerHTML = '';
      return;
    }
    hero.classList.remove('hidden');
    const count = app.screen_count ?? state.items.length;
    const topics = (app.topics || []).filter((t) => t && t !== 'all').slice(0, 3);
    const category = topics.length ? topics.map(topicLabel).join(', ') : 'UI';
    hero.innerHTML = `
      <div class="pik-company-hero-band">
        <div class="pik-company-hero-inner">
          <div class="pik-company-hero-row">
            ${emblemHtml(app, 'pik-app-emblem pik-app-emblem--hero pik-app-emblem--company')}
            <div class="pik-company-hero-text">
              <h1 class="pik-company-title">${escapeHtml(app.title)}</h1>
              <p class="pik-company-tagline">${escapeHtml(category)} · ${escapeHtml(platformLabel(app.platform))}</p>
            </div>
          </div>
          <div class="pik-company-meta">
            <div class="pik-company-meta-item">
              <span class="pik-company-meta-label">Платформа</span>
              <span class="pik-company-meta-value">${escapeHtml(platformLabel(app.platform))}</span>
            </div>
            <div class="pik-company-meta-item">
              <span class="pik-company-meta-label">Экраны</span>
              <span class="pik-company-meta-value">${escapeHtml(String(count))}</span>
            </div>
            <div class="pik-company-meta-item">
              <span class="pik-company-meta-label">Категория</span>
              <span class="pik-company-meta-value">${escapeHtml(category)}</span>
            </div>
          </div>
        </div>
        <nav class="pik-company-tabs" id="pik-company-tabs" aria-label="Тип экрана"></nav>
      </div>
      <div class="pik-company-toolbar">
        <p class="pik-company-count" id="pik-company-count"></p>
      </div>
    `;
    bindEmblems(hero);
    renderCompanyTabs(app);
    const countEl = $('pik-company-count');
    if (countEl) {
      const shown = state.items.length;
      const total = app.screen_count ?? shown;
      countEl.textContent = total
        ? `Показано ${shown} из ${total} экранов`
        : 'Нет экранов для выбранных фильтров';
    }
  }

  function renderSimilarApps(app) {
    const section = $('pik-company-similar');
    const grid = $('pik-company-similar-grid');
    const title = $('pik-company-similar-title');
    if (!section || !grid || !title || !app) return;

    const similar = (state.appsSnapshot || [])
      .filter((a) => a.id !== app.id)
      .slice(0, 8);

    if (!similar.length) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    title.textContent = `Похожие на ${app.title}`;
    grid.innerHTML = similar.map((a, i) => `
      <article class="pik-similar-app-card" style="--pik-i:${i}" data-app-key="${escapeHtml(a.id)}" tabindex="0" role="button">
        ${appPreviewHtml(a)}
        <footer class="pik-similar-app-footer">
          ${emblemHtml(a, 'pik-app-emblem pik-app-emblem--sm')}
          <span>${escapeHtml(a.title)}</span>
        </footer>
      </article>
    `).join('');

    grid.querySelectorAll('.pik-similar-app-card').forEach((card) => {
      card.querySelectorAll('img[data-src]').forEach((img) => hydrateImage(img, img.dataset.src));
      bindEmblems(card);
      const open = () => openApp(card.dataset.appKey || '');
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  function updateCompanyPage(app) {
    const active = !!(app && state.view === 'screens' && state.appKey);
    toggleCompanyChrome(active);
    renderCompanyHero(app);
    if (active) renderSimilarApps(app);
    else {
      $('pik-company-similar')?.classList.add('hidden');
      $('pik-company-hero')?.classList.add('hidden');
    }
  }

  function platformLabel(platform) {
    if (platform === 'ios') return 'iOS';
    if (platform === 'both') return 'Web + iOS';
    return 'Web';
  }

  function appPreviewHtml(app) {
    const previews = (app.previews || []).filter(Boolean);
    const cover = previews[0] || app.cover_url;
    if (!cover) {
      return `<div class="pik-app-previews pik-app-previews--empty">${emblemHtml(app, 'pik-app-emblem pik-app-emblem--hero')}</div>`;
    }
    if (previews.length <= 1) {
      return `<div class="pik-app-previews pik-app-previews--1"><img class="pik-app-cover" data-src="${escapeHtml(thumbSrc(cover))}" alt="" loading="eager" decoding="async" /></div>`;
    }
    const count = Math.min(4, previews.length);
    const cls = `pik-app-previews--${count}`;
    return `
      <div class="pik-app-previews ${cls}">
        ${previews.slice(0, 4).map((src) => `<img data-src="${escapeHtml(thumbSrc(src))}" alt="" loading="eager" decoding="async" />`).join('')}
      </div>`;
  }

  function appCardHtml(app, i) {
    const countLabel = `${app.screen_count} ${app.screen_count === 1 ? 'экран' : app.screen_count < 5 ? 'экрана' : 'экранов'}`;
    return `
      <article class="pik-app-card" style="--pik-i:${i % 24}" data-app-key="${escapeHtml(app.id)}" tabindex="0" role="button" aria-label="${escapeHtml(app.title)}">
        ${appPreviewHtml(app)}
        <footer class="pik-app-footer">
          ${emblemHtml(app)}
          <div class="pik-app-footer-text">
            <p class="pik-app-name">${escapeHtml(app.title)}</p>
            <p class="pik-app-meta">${escapeHtml(countLabel)} · ${escapeHtml(platformLabel(app.platform))}</p>
          </div>
        </footer>
      </article>
    `;
  }

  function openApp(appKey) {
    const key = String(appKey || '').trim();
    if (!key) return;
    state.appsSnapshot = state.apps.slice();
    state.view = 'screens';
    state.appKey = key;
    state.viewerPlaylistKey = '';
    state.topic = 'all';
    state.platform = 'all';
    state.screenType = 'all';
    state.offset = 0;
    state.hasMore = true;
    renderPlatforms();
    renderTopics();
    renderScreenTypes();
    $('pik-scroll')?.scrollTo({ top: 0 });
    loadItems({ reset: true });
  }

  function backToApps() {
    state.view = 'apps';
    state.appKey = '';
    state.appMeta = null;
    state.viewerPlaylistKey = '';
    state.items = [];
    state.offset = 0;
    state.hasMore = true;
    updateCompanyPage(null);
    $('pik-scroll')?.scrollTo({ top: 0 });
    loadItems({ reset: true });
  }

  function bindAppCards(root) {
    root.querySelectorAll('.pik-app-card').forEach((card) => {
      if (card.dataset.bound) return;
      card.dataset.bound = '1';
      card.querySelectorAll('.pik-app-cover, .pik-app-previews img').forEach((img) => {
        const raw = img.dataset.src || img.getAttribute('src');
        if (raw) {
          hydrateImage(img, raw);
        }
      });
      const open = () => openApp(card.dataset.appKey || '');
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
    bindEmblems(root);
  }

  function renderAppsGrid(apps, { append = false } = {}) {
    const grid = $('pik-apps-grid');
    const masonry = $('pik-masonry');
    const status = $('pik-status');
    const empty = $('pik-empty');
    if (!grid) return;

    masonry?.classList.add('hidden');
    updateCompanyPage(null);

    if (!apps.length && !append) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      empty?.classList.remove('hidden');
      status?.classList.add('hidden');
      return;
    }

    empty?.classList.add('hidden');
    status?.classList.add('hidden');
    grid.classList.remove('hidden');

    const start = append ? grid.querySelectorAll('.pik-app-card').length : 0;
    const chunk = apps.map((app, i) => appCardHtml(app, start + i)).join('');
    if (append) {
      grid.insertAdjacentHTML('beforeend', chunk);
      bindAppCards(grid);
    } else {
      grid.innerHTML = chunk;
      bindAppCards(grid);
    }
  }

  function showToast(msg) {
    document.querySelector('.pik-viewer-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'pik-viewer-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function mediaKind(item) {
    const src = String(item?.image_url || item?.thumb_url || '');
    if (item?.is_video || /\.(mp4|webm)(\?|$)/i.test(src)) return 'video';
    return 'image';
  }

  function fullMediaUrl(item) {
    return String(item?.image_url || item?.thumb_url || '').trim();
  }

  function resolutionLabel(item) {
    const w = Number(item?.width) || 0;
    const h = Number(item?.height) || 0;
    const plat = String(item?.platform || 'web').toLowerCase() === 'ios' ? 'iOS' : 'Desktop';
    if (w && h) return `${plat} (${w}×${h})`;
    return plat;
  }

  function currentViewerItem() {
    return state.viewerItems[state.viewerIndex] || null;
  }

  function renderViewerStage(item) {
    const stage = $('pik-viewer-stage');
    const frame = $('pik-viewer-frame');
    if (!stage || !item) return;
    const src = fullMediaUrl(item);
    const kind = mediaKind(item);
    frame?.classList.remove('is-loaded');
    if (kind === 'video') {
      stage.innerHTML = `<video class="pik-viewer-video" src="${escapeHtml(src)}" autoplay loop muted playsinline controls></video>`;
      frame?.classList.add('is-loaded');
      const video = stage.querySelector('video');
      video?.play?.().catch(() => {});
      return;
    }
    stage.innerHTML = `
      <div class="pik-viewer-loading" aria-live="polite">
        <span class="pik-spinner"></span>
        <span>Загрузка…</span>
      </div>
      <img class="pik-viewer-img" data-src="${escapeHtml(src)}" alt="${escapeHtml(item.title || '')}" decoding="async" />
    `;
    const img = stage.querySelector('.pik-viewer-img');
    const loading = stage.querySelector('.pik-viewer-loading');
    if (img) {
      const failTimer = setTimeout(() => {
        if (!frame?.classList.contains('is-loaded') && loading) {
          const label = loading.querySelector('span:last-child');
          if (label) label.textContent = 'Не удалось загрузить';
        }
      }, 15000);
      hydrateViewerImage(img, src, {
        onLoad: () => clearTimeout(failTimer),
        onFail: () => {
          clearTimeout(failTimer);
          const label = loading?.querySelector('span:last-child');
          if (label) label.textContent = 'Не удалось загрузить';
        },
      });
    }
  }

  function renderViewerFilmstrip(current) {
    const row = $('pik-viewer-similar-row');
    const section = $('pik-viewer-similar');
    if (!row || !current) return;
    const items = state.viewerItems || [];
    if (items.length <= 1) {
      section?.classList.add('hidden');
      return;
    }
    section?.classList.remove('hidden');
    row.innerHTML = items.map((it, idx) => `
      <button type="button" class="pik-viewer-similar-item${it.id === current.id ? ' is-active' : ''}" data-viewer-index="${idx}" aria-label="${escapeHtml(it.screen_type_label || it.title || `Экран ${idx + 1}`)}">
        <img data-src="${escapeHtml(it.thumb_url || it.image_url)}" alt="" loading="lazy" />
      </button>
    `).join('');
    row.querySelectorAll('img[data-src]').forEach((img) => hydrateImage(img, img.dataset.src));
    row.querySelectorAll('[data-viewer-index]').forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.viewerIndex);
        if (idx >= 0 && idx < items.length) {
          state.viewerIndex = idx;
          renderViewer();
        }
      };
    });
    row.querySelector('.is-active')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  function renderViewer() {
    const item = currentViewerItem();
    const viewer = $('pik-viewer');
    if (!viewer || !item) return;

    const appMeta = state.appMeta || {
      title: item.title,
      logo_url: null,
      initials: item.title?.slice(0, 2),
      accent: '#0a0a0a',
    };

    const headerApp = $('pik-viewer-header-app');
    if (headerApp) {
      headerApp.innerHTML = `
        ${emblemHtml(appMeta, 'pik-app-emblem pik-app-emblem--bar')}
        <div class="pik-viewer-header-text">
          <strong>${escapeHtml(appMeta.title || item.title)}</strong>
          <span>${escapeHtml(item.screen_type_label || 'Экран')} · ${state.viewerIndex + 1} / ${state.viewerItems.length}</span>
        </div>
      `;
      bindEmblems(headerApp);
    }

    renderViewerStage(item);

    const ctx = $('pik-viewer-context');
    if (ctx) {
      ctx.textContent = state.appKey
        ? `${appMeta.title} · ${item.screen_type_label || 'UI'}`
        : (item.screen_type_label || item.topic || 'UI');
    }

    const meta = $('pik-viewer-meta');
    if (meta) meta.textContent = resolutionLabel(item);

    $('pik-viewer-prev').disabled = state.viewerIndex <= 0;
    $('pik-viewer-next').disabled = state.viewerIndex >= state.viewerItems.length - 1;

    renderViewerFilmstrip(item);
  }

  async function openViewer(itemId) {
    if (state.appKey) {
      const cached = state.viewerItems?.length && state.viewerPlaylistKey === state.appKey;
      if (!cached) {
        const res = await window.api.pikFolderAppScreens?.({
          appKey: state.appKey,
          topic: state.topic,
          platform: state.platform,
          screenType: state.screenType,
        });
        state.viewerItems = res?.items || state.items;
        if (res?.app) state.appMeta = res.app;
        state.viewerPlaylistKey = state.appKey;
      }
    } else {
      state.viewerItems = state.items;
    }

    const idx = state.viewerItems.findIndex((it) => it.id === itemId);
    state.viewerIndex = idx >= 0 ? idx : 0;

    $('pik-viewer')?.classList.remove('hidden');
    document.body.classList.add('pik-viewer-open');
    renderViewer();
  }

  function closeViewer() {
    $('pik-viewer')?.classList.add('hidden');
    document.body.classList.remove('pik-viewer-open');
    const video = $('pik-viewer-stage')?.querySelector('video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
    }
  }

  function viewerNavigate(delta) {
    const next = state.viewerIndex + delta;
    if (next < 0 || next >= state.viewerItems.length) return;
    state.viewerIndex = next;
    renderViewer();
  }

  async function copyItemImage(item) {
    if (!item) return;
    try {
      await window.api.pikFolderCopyImage?.({ url: fullMediaUrl(item) });
      showToast('Скопировано в буфер');
    } catch (err) {
      showToast(err?.message || 'Не удалось скопировать');
    }
  }

  async function saveItemImage(item) {
    if (!item) return;
    try {
      const res = await window.api.pikFolderSaveImage?.({
        url: fullMediaUrl(item),
        filename: `${item.title || 'reference'}-${item.id}.png`.replace(/\s+/g, '-'),
      });
      if (res?.ok) showToast('Сохранено');
    } catch (err) {
      showToast(err?.message || 'Не удалось сохранить');
    }
  }

  async function fetchItemDataUrl(item) {
    const fromViewer = viewerImageDataUrl();
    if (fromViewer) return fromViewer;

    const urls = [item?.image_url, item?.thumb_url]
      .map((u) => mediaUrl(String(u || '').trim()))
      .filter(Boolean);
    const uniqueUrls = [...new Set(urls)];
    if (!uniqueUrls.length) throw new Error('Нет URL изображения');

    for (const url of uniqueUrls) {
      const dataUrl = await fetchImageProxy(url);
      if (dataUrl) return dataUrl;
    }
    throw new Error('Не удалось загрузить изображение');
  }

  function pikReferenceFilename(item) {
    const appTitle = state.appMeta?.title || item.title || 'reference';
    const screenLabel = item.screen_type_label || item.subtitle?.split('·')[0]?.trim() || 'screen';
    return `${appTitle}-${screenLabel}.png`.replace(/[^\w\u0400-\u04FF.-]+/gi, '-').slice(0, 80);
  }

  async function sendItemToKostin(item) {
    if (!item) return;
    if (typeof window.sendPikReferenceToAgent !== 'function') {
      showToast('Konstancia не загружен');
      return;
    }
    showToast('Отправляю в Konstancia…');
    try {
      const dataUrl = await fetchItemDataUrl(item);
      const appTitle = state.appMeta?.title || item.title || 'Reference';
      const screenLabel = item.screen_type_label || item.subtitle?.split('·')[0]?.trim() || 'Экран';
      const platform = String(item.platform || 'web').toLowerCase() === 'ios' ? 'iOS' : 'Web';
      closeViewer();
      await window.sendPikReferenceToAgent({
        dataUrl,
        filename: pikReferenceFilename(item),
        appTitle,
        screenLabel,
        platform,
      });
    } catch (err) {
      showToast(err?.message || 'Не удалось отправить');
    }
  }

  async function copyViewerImage() {
    await copyItemImage(currentViewerItem());
  }

  async function saveViewerImage() {
    await saveItemImage(currentViewerItem());
  }

  async function sendViewerToKostin() {
    await sendItemToKostin(currentViewerItem());
  }

  function bindViewerUi() {
    $('pik-viewer-close')?.addEventListener('click', closeViewer);
    $('pik-viewer-backdrop')?.addEventListener('click', closeViewer);
    $('pik-viewer-prev')?.addEventListener('click', () => viewerNavigate(-1));
    $('pik-viewer-next')?.addEventListener('click', () => viewerNavigate(1));
    $('pik-viewer-copy')?.addEventListener('click', copyViewerImage);
    $('pik-viewer-save')?.addEventListener('click', saveViewerImage);
    $('pik-viewer-kostin')?.addEventListener('click', sendViewerToKostin);

    document.addEventListener('keydown', (e) => {
      if ($('pik-viewer')?.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowLeft') viewerNavigate(-1);
      if (e.key === 'ArrowRight') viewerNavigate(1);
    });
  }

  function setSyncStatus(text, busy) {
    const el = $('pik-sync-status');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-busy', !!busy);
  }

  function cardHtml(item, i) {
    const src = resolveImageSrc(item);
    const videoBadge = item.is_video ? '<span class="pik-card-badge">Video</span>' : '';
    const plat = String(item.platform || 'web').toLowerCase() === 'ios' ? 'iOS' : 'Web';
    const platClass = plat === 'Web' ? 'pik-card-platform--web' : '';
    const mediaAspectClass = plat === 'iOS' ? 'pik-screen-card-media-wrap--ios' : 'pik-screen-card-media-wrap--web';
    const screenLabel = item.screen_type_label || item.subtitle?.split('·')[0]?.trim() || 'Экран';

    if (state.appKey) {
      return `
        <article class="pik-screen-card" style="--pik-i:${i % 32}" data-item-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(screenLabel)}">
          <span class="pik-screen-card-plat ${platClass}">${escapeHtml(plat)}</span>
          <div class="pik-screen-card-media-wrap ${mediaAspectClass}">
            <img class="pik-screen-card-media" data-src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" />
          </div>
          <div class="pik-screen-card-actions">
            <button type="button" class="pik-screen-card-btn pik-screen-card-btn--save" data-action="save">Сохранить</button>
            <button type="button" class="pik-screen-card-btn pik-screen-card-btn--copy" data-action="copy">Копировать</button>
            <button type="button" class="pik-screen-card-btn pik-screen-card-btn--agent" data-action="agent">Konstancia</button>
          </div>
        </article>
      `;
    }

    const cardTitle = item.title;
    const cardSubtitle = item.subtitle || sourceLabel(item.source);
    return `
      <article class="pik-card" style="--pik-i:${i % 32}" data-id="${escapeHtml(item.id)}" data-item-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)}">
        <span class="pik-card-platform ${platClass}">${escapeHtml(plat)}</span>
        <span class="pik-card-source">${escapeHtml(screenLabel || sourceLabel(item.source))}</span>
        <span class="pik-card-media-wrap">
          <img class="pik-card-media" data-src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" />
        </span>
        ${videoBadge}
        <div class="pik-card-overlay">
          <p class="pik-card-title">${escapeHtml(cardTitle)}</p>
          <p class="pik-card-subtitle">${escapeHtml(cardSubtitle)}</p>
          <p class="pik-card-tags">${escapeHtml((item.tags || []).filter((t) => t !== 'mobbin').slice(0, 4).join(' · '))}</p>
        </div>
      </article>
    `;
  }

  function bindCards(root) {
    root.querySelectorAll('.pik-card, .pik-screen-card').forEach((card) => {
      if (card.dataset.bound) return;
      card.dataset.bound = '1';
      const img = card.querySelector('.pik-card-media, .pik-screen-card-media');
      if (img) {
        const raw = img.dataset.src || img.getAttribute('src');
        if (raw) hydrateImage(img, raw);
      }

      card.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = card.dataset.itemId || card.dataset.id;
          const item = state.items.find((it) => it.id === id);
          if (!item) return;
          if (btn.dataset.action === 'save') saveItemImage(item);
          else if (btn.dataset.action === 'copy') copyItemImage(item);
          else if (btn.dataset.action === 'agent') sendItemToKostin(item);
        });
      });

      const open = () => {
        const id = card.dataset.itemId || card.dataset.id;
        if (id) openViewer(id);
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  function renderMasonry(items, { append = false } = {}) {
    const masonry = $('pik-masonry');
    const grid = $('pik-apps-grid');
    const status = $('pik-status');
    const empty = $('pik-empty');
    if (!masonry) return;

    grid?.classList.add('hidden');
    updateCompanyPage(state.appMeta);

    if (!items.length && !append) {
      masonry.innerHTML = '';
      masonry.classList.add('hidden');
      empty?.classList.remove('hidden');
      status?.classList.add('hidden');
      return;
    }

    empty?.classList.add('hidden');
    status?.classList.add('hidden');
    masonry.classList.remove('hidden');
    masonry.classList.toggle('pik-masonry--company', !!state.appKey);

    const start = append ? masonry.querySelectorAll('.pik-card, .pik-screen-card').length : 0;
    const chunk = items.map((item, i) => cardHtml(item, start + i)).join('');

    if (append) {
      masonry.insertAdjacentHTML('beforeend', chunk);
      bindCards(masonry);
    } else {
      masonry.innerHTML = chunk;
      bindCards(masonry);
    }

    if (!state.appKey) updateCols();
  }

  function setLoading(on) {
    state.loading = on;
    const status = $('pik-status');
    const masonry = $('pik-masonry');
    const grid = $('pik-apps-grid');
    const empty = $('pik-empty');
    const hasContent = state.view === 'apps' ? state.apps.length : state.items.length;
    if (on && !hasContent) {
      status?.classList.remove('hidden');
      masonry?.classList.add('hidden');
      grid?.classList.add('hidden');
      empty?.classList.add('hidden');
    }
  }

  function bindScroll() {
    if (scrollBound) return;
    const scroll = $('pik-scroll');
    if (!scroll) return;
    scrollBound = true;
    scroll.addEventListener('scroll', () => {
      if (state.loading || state.loadingMore || !state.hasMore) return;
      const nearBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 480;
      if (nearBottom) loadItems({ reset: false });
    }, { passive: true });
  }

  async function loadItems({ reset = true, syncMobbin = false } = {}) {
    const hasStale = reset && (
      (state.view === 'apps' && state.apps.length > 0)
      || (state.view === 'screens' && state.items.length > 0)
    );

    if (reset) {
      if (state.loading) return;
      if (!hasStale) setLoading(true);
      state.offset = 0;
      state.hasMore = true;
    } else {
      if (state.loadingMore || !state.hasMore) return;
      state.loadingMore = true;
    }

    try {
      ensureAppsAtRoot();

      if (reset && syncMobbin) {
        const status = await window.api.pikFolderMobbinStatus?.().catch(() => null);
        if (status?.mobbinConfigured && (status.total || 0) < 800) {
          setSyncStatus('Загрузка референсов Mobbin…', true);
          await window.api.pikFolderSyncMobbin?.().catch(() => {});
          setSyncStatus('', false);
        }
      }

      const pageSize = state.view === 'apps' ? APP_PAGE_SIZE : SCREEN_PAGE_SIZE;
      const res = await window.api.pikFolderList({
        view: state.view,
        appKey: state.appKey || undefined,
        topic: state.topic,
        platform: state.platform,
        screenType: state.screenType,
        q: state.q,
        limit: pageSize,
        offset: reset ? 0 : state.offset,
      });

      state.view = res?.view || state.view;
      if (!state.appKey) state.view = 'apps';
      state.topics = res?.topics || state.topics;
      state.platforms = res?.platforms || state.platforms;
      state.screenTypes = res?.screenTypes || state.screenTypes;
      state.catalogTotal = res?.catalogTotal || 0;
      state.topicCounts = res?.topicCounts || null;
      state.platformCounts = res?.platformCounts || null;
      state.screenTypeCounts = res?.screenTypeCounts || null;
      state.source = res?.source || 'local';

      if (state.view === 'apps') {
        const batch = res?.apps || [];
        if (reset) {
          state.apps = batch;
          renderPlatforms();
          renderTopics();
          renderScreenTypes();
          renderAppsGrid(state.apps);
        } else {
          state.apps.push(...batch);
          renderAppsGrid(batch, { append: true });
        }
        state.offset = reset ? batch.length : state.offset + batch.length;
        state.hasMore = !!res?.hasMore && batch.length > 0;
        const total = res?.total || state.apps.length;
        setSyncStatus(`${state.apps.length} из ${total} приложений`, false);
      } else {
        const batch = res?.items || [];
        state.appMeta = res?.app || state.appMeta;
        state.viewerPlaylistKey = '';
        updateCompanyPage(state.appMeta);
        if (reset) {
          state.items = batch;
          renderPlatforms();
          renderTopics();
          renderScreenTypes();
          renderMasonry(state.items);
        } else {
          state.items.push(...batch);
          renderMasonry(batch, { append: true });
        }
        state.offset = reset ? batch.length : state.offset + batch.length;
        state.hasMore = !!res?.hasMore && batch.length > 0;
        const total = res?.total || state.items.length;
        const appName = state.appMeta?.title || 'Приложение';
        setSyncStatus(`${appName}: ${state.items.length} из ${total}`, false);
      }
    } catch (err) {
      if (reset) {
        $('pik-masonry')?.classList.add('hidden');
        $('pik-apps-grid')?.classList.add('hidden');
        const empty = $('pik-empty');
        empty?.classList.remove('hidden');
        if (empty) {
          empty.innerHTML = `<strong>Не удалось загрузить</strong>${escapeHtml(err?.message || String(err))}`;
        }
      }
    } finally {
      $('pik-status')?.classList.add('hidden');
      state.loading = false;
      state.loadingMore = false;
    }
  }

  function bindUi() {
    const input = $('pik-search-input');
    input?.addEventListener('input', () => {
      state.q = input.value.trim();
      if (state.view === 'screens') {
        state.view = 'apps';
        state.appKey = '';
        state.appMeta = null;
      }
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadItems({ reset: true }), 280);
    });

    $('pik-refresh')?.addEventListener('click', async () => {
      setSyncStatus('Синхронизация…', true);
      try {
        await window.api.pikFolderSyncSeed?.().catch(() => null);
        await loadItems({ reset: true, syncMobbin: true });
      } finally {
        setSyncStatus('', false);
      }
    });

    $('pik-app-back')?.addEventListener('click', backToApps);

    const scroll = $('pik-scroll');
    if (scroll && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateCols);
      resizeObserver.observe(scroll);
    }
    window.addEventListener('resize', updateCols);
    bindScroll();
    bindViewerUi();
  }

  async function activatePikFolderPage() {
    if (!$('pik-masonry')) return;
    state.view = 'apps';
    state.appKey = '';
    state.appMeta = null;
    state.viewerPlaylistKey = '';
    updateCompanyPage(null);
    $('pik-masonry')?.classList.add('hidden');
    bindScroll();
    await loadItems({ reset: true, syncMobbin: false });
    updateCols();
    setTimeout(() => {
      window.api.pikFolderRemoteStatus?.().then((st) => {
        if (st?.synced && st.remoteCount) {
          setSyncStatus(`${st.remoteCount} референсов · База`, false);
        }
      }).catch(() => {});
    }, 8000);
  }

  window.activatePikFolderPage = activatePikFolderPage;

  document.addEventListener('DOMContentLoaded', () => {
    bindUi();
  });
})();
