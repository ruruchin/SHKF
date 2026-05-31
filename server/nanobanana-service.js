const DEFAULT_BASE_URL = 'https://www.nananobanana.com';
const VIDEO_MODEL_RE = /video|jimeng|grok-imagine|seedance/i;
const VALID_ASPECTS = new Set([
  'auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9',
]);
const MAX_REF_BYTES = 1.5 * 1024 * 1024;
const MAX_PROMPT_CHARS = 8000;

export function formatNanobananaError(message, httpStatus) {
  const raw = String(message || '').trim();
  if (!raw) return 'Неизвестная ошибка генерации';

  const status = Number(httpStatus) || 0;
  if (
    status === 413
    || /\b413\b|payload too large|entity too large|request too large/i.test(raw)
  ) {
    return 'Запрос слишком большой (413). Уберите референсы, выберите 1K или сократите промпт.';
  }

  if (/INVALID_ARGUMENT|invalid argument/i.test(raw)) {
    return 'Сервис отклонил параметры. Попробуйте без референсов или другое соотношение/разрешение.';
  }
  if (/proxy_config_error/i.test(raw)) {
    return 'Ошибка прокси NanoBanana. Попробуйте без референсов или смените соотношение сторон / разрешение.';
  }

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      const nested = parsed?.error?.message || parsed?.message;
      if (nested && nested !== raw) return formatNanobananaError(nested);
    } catch { /* not json */ }
  }

  const vertexMatch = raw.match(/"message"\s*:\s*"([^"]+)"/i);
  if (vertexMatch?.[1]) return formatNanobananaError(vertexMatch[1]);

  return raw.length > 320 ? `${raw.slice(0, 320)}…` : raw;
}

function isRetryableGenerateError(message, httpStatus) {
  const m = String(message || '');
  const status = Number(httpStatus) || 0;
  if (status === 413) return true;
  return /INVALID_ARGUMENT|invalid argument|proxy_config_error|Request contains an invalid|\b413\b|payload too large/i.test(m);
}

function trimPromptForApi(prompt) {
  const text = String(prompt || '').trim();
  if (text.length <= MAX_PROMPT_CHARS) return text;
  return `${text.slice(0, MAX_PROMPT_CHARS - 1)}…`;
}

function normalizeAspectForApi(aspectRatio) {
  const aspect = String(aspectRatio || 'auto').trim();
  return VALID_ASPECTS.has(aspect) ? aspect : 'auto';
}

function filterReferenceUrls(urls) {
  if (!Array.isArray(urls)) return [];
  return urls.filter((url) => {
    const raw = String(url || '').trim();
    if (!raw) return false;
    if (!raw.startsWith('data:image/')) return true;
    const base64 = raw.split(',')[1] || '';
    return base64.length * 0.75 <= MAX_REF_BYTES;
  }).slice(0, 9);
}

function normalizeResolution(res) {
  const r = String(res || '1K').toUpperCase();
  return ['1K', '2K', '4K'].includes(r) ? r : '1K';
}

function stripResolutionSuffix(model) {
  return String(model || '').replace(/-(2k|4k|fast(?:-2k|-4k)?)$/i, '');
}

function resolutionSuffix(res) {
  return normalizeResolution(res) === '4K' ? '4k' : '2k';
}

function modelCandidatesForResolution(family, resolution) {
  const familyId = stripResolutionSuffix(String(family || ''));
  if (!familyId) return [];
  const res = normalizeResolution(resolution);
  if (res === '1K') return [familyId];

  const suffix = resolutionSuffix(res);
  const candidates = [
    `${familyId}-${suffix}`,
    `${familyId}-fast-${suffix}`,
  ];
  return candidates;
}

function pickModelForResolution(models, family, resolution) {
  if (!Array.isArray(models) || !models.length) {
    return modelCandidatesForResolution(family, resolution)[0] || stripResolutionSuffix(family);
  }

  const res = normalizeResolution(resolution);
  const familyId = stripResolutionSuffix(String(family || ''));

  if (res === '1K') {
    if (/-2k|-4k/i.test(String(family || ''))) {
      return models.find((m) => m.name === familyId)?.name || familyId;
    }
    return models.find((m) => m.name === familyId)?.name || familyId;
  }

  const suffix = resolutionSuffix(res);
  for (const id of modelCandidatesForResolution(familyId, res)) {
    if (models.some((m) => m.name === id)) return id;
  }

  const fuzzy = models.find((m) => m.name.startsWith(familyId) && m.name.endsWith(`-${suffix}`));
  return fuzzy?.name || null;
}

function bodyKey(body) {
  return JSON.stringify({
    model: body.model,
    resolution: body.resolution,
    aspectRatio: body.aspectRatio,
    mode: body.mode,
    numOutputs: body.numOutputs,
    refs: Array.isArray(body.referenceImageUrls) ? body.referenceImageUrls.length : 0,
  });
}

function buildGenerateAttempts(payload) {
  const prompt = trimPromptForApi(payload.prompt);
  const model = payload.model;
  const mode = payload.mode || 'sync';
  const numOutputs = payload.numOutputs;
  const refs = filterReferenceUrls(payload.referenceImageUrls);
  const aspect = normalizeAspectForApi(payload.aspectRatio);
  const resolution = normalizeResolution(payload.resolution);
  const requestedHighRes = resolution === '2K' || resolution === '4K';

  const mk = (overrides) => {
    const body = {
      prompt,
      model,
      resolution,
      size: resolution,
      aspectRatio: aspect,
      mode,
      ...(numOutputs != null ? { numOutputs } : {}),
      ...(refs.length ? { referenceImageUrls: refs } : {}),
      ...overrides,
    };
    if (overrides.resolution == null && overrides.model && overrides.model !== model) {
      const downgraded = !/-2k|-4k/i.test(String(overrides.model));
      if (downgraded) {
        body.resolution = '1K';
        body.size = '1K';
      }
    }
    if (!body.referenceImageUrls?.length) delete body.referenceImageUrls;
    return body;
  };

  const attempts = [];
  const seen = new Set();
  const add = (overrides, label) => {
    const body = mk(overrides);
    const key = bodyKey(body);
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push({ body, label });
  };

  // 1) Точные параметры пользователя: 2K/4K-модель + выбранное соотношение
  add({}, 'primary');

  // 2) Без референсов (частая причина INVALID_ARGUMENT), модель и aspect без изменений
  if (refs.length) {
    add({ referenceImageUrls: undefined }, 'without references');
  }

  // 3) Если выбран auto — пробуем 16:9, сохраняя разрешение модели
  if (aspect === 'auto') {
    add({ aspectRatio: '16:9' }, 'aspect 16:9');
    if (refs.length) add({ aspectRatio: '16:9', referenceImageUrls: undefined }, '16:9 without references');
  }

  // 4) Понижение до 1K — только если пользователь сам выбрал 1K
  const baseModel = stripResolutionSuffix(model);
  if (!requestedHighRes && baseModel && baseModel !== model) {
    add({ model: baseModel, resolution: '1K' }, 'model 1K');
    if (refs.length) add({ model: baseModel, resolution: '1K', referenceImageUrls: undefined }, '1K without references');
    if (aspect === 'auto') {
      add({ model: baseModel, resolution: '1K', aspectRatio: '16:9' }, '1K aspect 16:9');
    }
  }

  return attempts;
}

export class NanobananaService {
  constructor() {
    this.settings = {
      apiKey: '',
      baseUrl: DEFAULT_BASE_URL,
      requestMode: 'sync',
    };
  }

  configure(settings = {}) {
    this.settings = {
      ...this.settings,
      ...settings,
      baseUrl: String(settings.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, ''),
    };
  }

  getHeaders() {
    const key = String(this.settings.apiKey || '').trim();
    if (!key) throw new Error('Укажите API-ключ NanoBanana в настройках');
    return {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    };
  }

  apiUrl(path) {
    return `${this.settings.baseUrl}${path}`;
  }

  async requestJson(path, { method = 'GET', body } = {}) {
    const headers = { ...this.getHeaders() };
    const init = { method, headers };
    if (body != null) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(this.apiUrl(path), init);
    } catch (err) {
      throw new Error(`Сеть NanoBanana: ${err.message}`);
    }

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(text?.slice(0, 200) || `Ошибка HTTP ${response.status}`);
    }

    if (!response.ok) {
      const msg = data?.error || data?.message || data?.msg || text?.slice(0, 200) || `HTTP ${response.status}`;
      const err = new Error(formatNanobananaError(msg, response.status));
      err.httpStatus = response.status;
      throw err;
    }

    return data;
  }

  async getCredits() {
    const data = await this.requestJson('/api/v1/credits');
    return { credits: data?.data?.credits ?? 0 };
  }

  async getModels() {
    const data = await this.requestJson('/api/v1/models');
    const models = Array.isArray(data?.data) ? data.data : [];
    return {
      models: models
        .filter((m) => m?.name && !VIDEO_MODEL_RE.test(`${m.name} ${m.displayName || ''}`))
        .map((m) => ({
          name: m.name,
          displayName: m.displayName || m.name,
          creditsCost: m.creditsCost ?? 1,
          supportsImageInput: m.supportsImageInput !== false,
          requiresPro: !!m.requiresPro,
        })),
    };
  }

  async getGeneration(id) {
    const data = await this.requestJson(`/api/v1/generate?id=${encodeURIComponent(id)}`);
    return normalizeGenerationRecord(data?.data);
  }

  async generateOnce(body, payload) {
    const fallbackLabel = body._fallbackLabel || null;
    const apiBody = { ...body };
    delete apiBody._fallbackLabel;
    const data = await this.requestJson('/api/v1/generate', { method: 'POST', body: apiBody });

    if (data?.async && data?.generationId) {
      const polled = await this.waitForGeneration(data.generationId, {
        timeoutMs: payload.timeoutMs || 180000,
      });
      return {
        ok: true,
        ...polled,
        creditsUsed: data.creditsUsed,
        remainingCredits: data.remainingCredits,
        modelUsed: polled.record?.modelUsed || apiBody.model,
        resolution: apiBody.resolution,
        usedFallback: fallbackLabel,
      };
    }

    if (!data?.success) {
      throw new Error(formatNanobananaError(data?.error || data?.message || 'Генерация не удалась'));
    }

    return {
      ok: true,
      generationId: data.generationId,
      imageUrls: data.imageUrls || [],
      creditsUsed: data.creditsUsed,
      remainingCredits: data.remainingCredits,
      prompt: apiBody.prompt,
      model: apiBody.model,
      modelUsed: data.modelUsed || apiBody.model,
      resolution: apiBody.resolution,
      aspectRatio: apiBody.aspectRatio,
      usedFallback: fallbackLabel,
    };
  }

  async generate(payload) {
    if (!String(payload.prompt || '').trim()) throw new Error('Введите промпт');
    if (!payload.model) throw new Error('Выберите модель');

    const resolution = normalizeResolution(payload.resolution);
    let model = payload.model;
    try {
      const { models } = await this.getModels();
      model = pickModelForResolution(models, stripResolutionSuffix(model), resolution);
    } catch { /* keep client model */ }

    if ((resolution === '2K' || resolution === '4K') && (!model || !/-2k|-4k/i.test(model))) {
      throw new Error(`Выбранная модель не поддерживает ${resolution}. Попробуйте Nano Banan 2 (PRO).`);
    }

    const attempts = buildGenerateAttempts({
      ...payload,
      model,
      resolution,
      mode: payload.mode || this.settings.requestMode || 'sync',
    });

    let lastError = null;
    for (let i = 0; i < attempts.length; i += 1) {
      const { body, label } = attempts[i];
      const sendBody = { ...body };
      if (i > 0) sendBody._fallbackLabel = label;
      try {
        return await this.generateOnce(sendBody, payload);
      } catch (err) {
        lastError = err;
        const msg = err.message || String(err);
        const canRetry = i < attempts.length - 1 && isRetryableGenerateError(msg, err.httpStatus);
        if (!canRetry) break;
      }
    }

    throw lastError || new Error('Генерация не удалась');
  }

  async waitForGeneration(generationId, { timeoutMs = 180000, intervalMs = 2500 } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const record = await this.getGeneration(generationId);
      if (record.processingStatus === 'completed') {
        const urls = record.outputImageUrls?.length
          ? record.outputImageUrls
          : (record.outputImageUrl ? [record.outputImageUrl] : []);
        if (!urls.length) throw new Error('Генерация завершилась без изображения');
        return {
          generationId,
          imageUrls: urls,
          record,
        };
      }
      if (record.processingStatus === 'failed') {
        throw new Error(record.errorMessage || 'Генерация не удалась');
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('Превышено время ожидания генерации');
  }
}

function normalizeGenerationRecord(data) {
  if (!data) return { processingStatus: 'unknown' };
  return {
    id: data.id,
    prompt: data.prompt,
    outputImageUrl: data.outputImageUrl,
    outputImageUrls: data.outputImageUrls,
    processingStatus: data.processingStatus,
    errorMessage: data.errorMessage,
    modelUsed: data.modelUsed,
    creditsUsed: data.creditsUsed,
    createdAt: data.createdAt,
  };
}

/** Pick model id for family + resolution toggle (1K / 2K / 4K). */
export function resolveModelForResolution(models, familyName, resolution) {
  return pickModelForResolution(models, familyName, resolution) || stripResolutionSuffix(familyName);
}

export function groupModelsForUi(models) {
  const imageModels = (models || []).filter((m) => m?.name);
  const families = new Map();

  for (const m of imageModels) {
    const base = m.name.replace(/-(2k|4k|2K|4K|fast(?:-2k|-4k)?)$/i, '');
    if (!families.has(base)) {
      families.set(base, {
        id: base,
        label: m.displayName.replace(/\s+(2K|4K|Fast).*$/i, '').trim() || m.displayName,
        creditsCost: m.creditsCost,
        requiresPro: m.requiresPro,
        supportsImageInput: m.supportsImageInput,
        variants: [],
      });
    }
    families.get(base).variants.push(m);
    const fam = families.get(base);
    if (!/-2k|-4k|-fast/i.test(m.name)) {
      fam.label = m.displayName;
      fam.creditsCost = m.creditsCost;
    }
  }

  return [...families.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}
