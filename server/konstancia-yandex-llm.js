const YANDEX_FM_BASE = 'https://llm.api.cloud.yandex.net/v1';
const DEEPSEEK_MODEL = 'deepseek-v4-flash';

let config = {
  apiKey: '',
  folderId: '',
};

export function configureKonstanciaYandex({ apiKey = '', folderId = '' } = {}) {
  config = {
    apiKey: String(apiKey || '').trim(),
    folderId: String(folderId || '').trim(),
  };
}

export function isKonstanciaYandexConfigured() {
  return !!config.apiKey;
}

function yandexHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Api-Key ${config.apiKey}`,
    ...(config.folderId ? { 'x-folder-id': config.folderId } : {}),
  };
}

async function fetchYandexModels() {
  const res = await fetch(`${YANDEX_FM_BASE}/models`, {
    headers: yandexHeaders(),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }
  return res.json();
}

async function resolveFolderId() {
  if (config.folderId) return config.folderId;

  const json = await fetchYandexModels();
  const models = Array.isArray(json?.data) ? json.data : [];
  const deepseek = models.find((m) => String(m?.id || '').includes(DEEPSEEK_MODEL));
  const candidate = String(deepseek?.id || models[0]?.id || '');
  const match = candidate.match(/gpt:\/\/([^/]+)\//);
  if (!match) {
    throw new Error('Konstancia: не удалось подключить движок.');
  }
  config.folderId = match[1];
  return config.folderId;
}

export async function getKonstanciaYandexFolderId() {
  if (!isKonstanciaYandexConfigured()) return '';
  return resolveFolderId();
}

export function getKonstanciaYandexApiKey() {
  return config.apiKey;
}

async function resolveModelUri() {
  const folderId = await resolveFolderId();
  return `gpt://${folderId}/${DEEPSEEK_MODEL}/latest`;
}

export async function getKonstanciaYandexStatus() {
  if (!isKonstanciaYandexConfigured()) {
    return { ok: false, ready: false, trained: false };
  }
  try {
    await resolveFolderId();
    return { ok: true, ready: true, trained: true, mode: 'konstancia' };
  } catch (err) {
    return {
      ok: false,
      ready: false,
      trained: false,
      mode: 'konstancia',
      message: err?.message || String(err),
    };
  }
}

export function konstanciaMessageContent(text, images = []) {
  const dataUrls = (Array.isArray(images) ? images : [])
    .map((img) => String(img?.dataUrl || img?.url || '').trim())
    .filter((url) => /^data:image\//i.test(url));
  const prompt = String(text || '').trim() || (dataUrls.length ? 'Опиши приложенное изображение.' : '');
  if (!dataUrls.length) return prompt;
  const parts = [];
  if (prompt) parts.push({ type: 'text', text: prompt });
  for (const url of dataUrls.slice(0, 4)) {
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return parts;
}

export async function konstanciaYandexChat({
  messages = [],
  maxTokens = 640,
  temperature = 0.75,
} = {}) {
  if (!isKonstanciaYandexConfigured()) {
    return { ok: false, message: 'Konstancia не подключена.' };
  }

  const model = await resolveModelUri();
  const res = await fetch(`${YANDEX_FM_BASE}/chat/completions`, {
    method: 'POST',
    headers: yandexHeaders(),
    body: JSON.stringify({
      model,
      messages,
      max_tokens: Math.max(128, Math.min(8192, Number(maxTokens) || 640)),
      temperature: Math.max(0, Math.min(1.5, Number(temperature) || 0.75)),
      reasoning_effort: 'none',
    }),
    signal: AbortSignal.timeout(180000),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `HTTP ${res.status}`;
    return { ok: false, message: msg };
  }

  const message = json?.choices?.[0]?.message || {};
  const content = String(message.content || message.reasoning_content || '').trim();
  if (!content) {
    return { ok: false, message: 'Konstancia вернула пустой ответ.' };
  }

  return {
    ok: true,
    content,
    model: 'konstancia',
    followups: [],
    usage: json?.usage || null,
  };
}
