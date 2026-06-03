import https from 'https';

const SCREENS_URL = 'https://api.mobbin.com/v1/screens/search';
const FLOWS_URL = 'https://api.mobbin.com/v1/flows/search';

function httpsJson(url, { method = 'POST', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json, text: data });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function normalizeScreen(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = String(raw.mobbin_url || raw.url || '').trim();
  if (!url) return null;
  return {
    id: String(raw.id || ''),
    source: 'mobbin-live',
    title: String(raw.app_name || raw.title || 'Mobbin screen').trim() || 'Mobbin screen',
    url,
    imageUrl: String(raw.image_url || '').trim() || null,
    platform: String(raw.platform || '').trim().toLowerCase(),
    surface: 'screen',
    tags: ['mobbin', raw.platform].filter(Boolean),
    quality: 5,
    note: '',
  };
}

function normalizeFlow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = String(raw.mobbin_url || raw.url || '').trim();
  if (!url) return null;
  const screens = Array.isArray(raw.screens) ? raw.screens : [];
  return {
    id: String(raw.id || ''),
    source: 'mobbin-flow',
    title: String(raw.name || raw.app_name || raw.title || 'Mobbin flow').trim() || 'Mobbin flow',
    url,
    platform: String(raw.platform || '').trim().toLowerCase(),
    surface: 'flow',
    tags: ['mobbin', 'flow', raw.platform].filter(Boolean),
    quality: 5,
    note: screens.length ? `${screens.length} screens in flow` : '',
    screens: screens.map((s) => ({
      imageUrl: s.image_url || null,
      mobbinUrl: s.mobbin_url || null,
    })).filter((s) => s.imageUrl || s.mobbinUrl),
  };
}

export function inferMobbinPlatform(query) {
  const text = String(query || '').toLowerCase();
  if (/\bios\b|iphone|mobile\s*app|приложени[ея]\s+ios|мобильн/i.test(text)) return 'ios';
  return 'web';
}

export function isMobbinConfigured(settings = {}) {
  return !!String(settings?.mobbinApiKey || settings?.apiKey || '').trim();
}

export class MobbinService {
  constructor() {
    this.apiKey = '';
    this.enabled = true;
  }

  configure(settings = {}) {
    this.apiKey = String(settings.mobbinApiKey || settings.apiKey || '').trim();
    this.enabled = settings.mobbinEnabled !== false;
  }

  isConfigured() {
    return this.enabled && !!this.apiKey;
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      enabled: this.enabled,
    };
  }

  async searchScreens(query, { platform, limit = 8, mode = 'deep' } = {}) {
    if (!this.isConfigured()) {
      return { ok: false, message: 'Укажите Mobbin API key в Настройки → ИИ Агент → Mobbin', screens: [] };
    }
    const body = {
      query: String(query || '').trim().slice(0, 500),
      platform: platform === 'ios' ? 'ios' : 'web',
      limit: Math.max(1, Math.min(20, Number(limit) || 8)),
      mode: mode === 'fast' ? 'fast' : 'deep',
    };
    const res = await httpsJson(SCREENS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body,
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Mobbin: неверный или просроченный API key', screens: [] };
    }
    if (res.status >= 400) {
      const msg = res.json?.error?.message || res.json?.message || `Mobbin API ${res.status}`;
      return { ok: false, message: msg, screens: [] };
    }
    const screens = (res.json?.screens || [])
      .map(normalizeScreen)
      .filter(Boolean);
    return { ok: true, screens, query: body.query };
  }

  async searchFlows(query, { platform, limit = 4 } = {}) {
    if (!this.isConfigured()) {
      return { ok: false, message: 'Укажите Mobbin API key в Настройки → ИИ Агент → Mobbin', flows: [] };
    }
    const body = {
      query: String(query || '').trim().slice(0, 500),
      platform: platform === 'ios' ? 'ios' : 'web',
      limit: Math.max(1, Math.min(10, Number(limit) || 4)),
    };
    const res = await httpsJson(FLOWS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body,
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Mobbin: неверный или просроченный API key', flows: [] };
    }
    if (res.status >= 400) {
      const msg = res.json?.error?.message || res.json?.message || `Mobbin API ${res.status}`;
      return { ok: false, message: msg, flows: [] };
    }
    const flows = (res.json?.flows || [])
      .map(normalizeFlow)
      .filter(Boolean);
    return { ok: true, flows, query: body.query };
  }

  /**
   * Screens + flows for site/app generation context.
   */
  async gatherReferences(query, options = {}) {
    const platform = options.platform || inferMobbinPlatform(query);
    const screenLimit = options.screenLimit ?? 6;
    const flowLimit = options.flowLimit ?? 3;

    const [screensResult, flowsResult] = await Promise.all([
      this.searchScreens(query, { platform, limit: screenLimit, mode: options.mode || 'deep' }),
      this.searchFlows(query, { platform, limit: flowLimit }),
    ]);

    const refs = [];
    for (const flow of flowsResult.flows || []) {
      refs.push({
        id: flow.id,
        source: flow.source,
        title: flow.title,
        url: flow.url,
        platform: flow.platform,
        surface: flow.surface,
        tags: flow.tags,
        quality: flow.quality,
        note: flow.note,
      });
    }
    for (const screen of screensResult.screens || []) {
      refs.push(screen);
    }

    const errors = [];
    if (!screensResult.ok && screensResult.message) errors.push(screensResult.message);
    if (!flowsResult.ok && flowsResult.message) errors.push(flowsResult.message);

    return {
      ok: refs.length > 0 || errors.length === 0,
      refs,
      platform,
      screens: screensResult.screens || [],
      flows: flowsResult.flows || [],
      message: errors[0] || null,
      live: true,
    };
  }

  buildContextBlock(refs, { platform } = {}) {
    if (!refs?.length) {
      return '## Mobbin reference signals\nНет live-референсов Mobbin. Используй локальную design memory и лучшие практики B2B/SaaS UI.';
    }
    const lines = [`## Mobbin reference signals (${platform || 'mixed'})`];
    refs.slice(0, 10).forEach((ref, idx) => {
      const tags = (ref.tags || []).slice(0, 8).join(', ');
      lines.push(`${idx + 1}. **${ref.title}** (${ref.surface || ref.source}, ${ref.platform || 'web'})`);
      if (tags) lines.push(`   tags: ${tags}`);
      if (ref.note) lines.push(`   note: ${ref.note}`);
      lines.push(`   url: ${ref.url}`);
      if (ref.imageUrl) lines.push(`   preview: ${ref.imageUrl}`);
    });
    lines.push('');
    lines.push('Используй референсы для: иерархии, плотности, навигации, карточек, таблиц, empty states — не копируй бренды один-в-один.');
    return lines.join('\n');
  }
}
