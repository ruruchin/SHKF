import {
  getKonstanciaYandexFolderId,
  isKonstanciaYandexConfigured,
} from './konstancia-yandex-llm.js';

const VISION_URL = 'https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze';

function dataUrlToBase64(dataUrl) {
  const raw = String(dataUrl || '').trim();
  const match = raw.match(/^data:[^;]+;base64,(.+)$/i);
  return match ? match[1] : '';
}

function collectOcrLines(textDetection) {
  const lines = [];
  for (const page of textDetection?.pages || []) {
    for (const block of page.blocks || []) {
      for (const line of block.lines || []) {
        const text = (line.words || []).map((w) => w.text).join(' ').trim();
        if (text) lines.push(text);
      }
    }
  }
  return [...new Set(lines)].filter((line) => !isOcrNoise(line));
}

const OCR_NOISE_RE = [
  /^Спросите Konstancia/i,
  /^Подсказки$/i,
  /переключитесь на GigaChat/i,
  /без vision/i,
  /вставьте код для проверки/i,
  /^Думаю\.?\.?\.?$/i,
  /^Konstancia$/i,
];

function isOcrNoise(line) {
  const text = String(line || '').trim();
  if (!text) return true;
  return OCR_NOISE_RE.some((re) => re.test(text));
}

function collectClassificationLabels(classification) {
  const labels = [];
  for (const prop of classification?.properties || []) {
    const name = String(prop?.name || prop?.label || '').trim();
    if (name) labels.push(name);
  }
  return labels;
}

async function analyzeOneImage(dataUrl, { apiKey, folderId }) {
  const content = dataUrlToBase64(dataUrl);
  if (!content) return null;

  const res = await fetch(VISION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${apiKey}`,
    },
    body: JSON.stringify({
      folderId,
      analyze_specs: [{
        content,
        features: [
          {
            type: 'TEXT_DETECTION',
            text_detection_config: { language_codes: ['ru', 'en'] },
          },
          { type: 'CLASSIFICATION' },
        ],
      }],
    }),
    signal: AbortSignal.timeout(45000),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || json?.error?.message || `Vision HTTP ${res.status}`);
  }

  const parts = json?.results?.[0]?.results || [];
  let ocr = [];
  let labels = [];
  for (const item of parts) {
    if (item.textDetection) ocr = collectOcrLines(item.textDetection);
    if (item.classification) labels = collectClassificationLabels(item.classification);
  }

  return { ocr, labels };
}

/**
 * OCR + classification via Yandex Vision (same API key as Konstancia LLM).
 * DeepSeek on Yandex FM is text-only — images are described here first.
 */
export async function buildKonstanciaImageContext(images = [], { apiKey = '' } = {}) {
  if (!isKonstanciaYandexConfigured() && !apiKey) return '';

  const list = (Array.isArray(images) ? images : [])
    .map((img) => String(img?.dataUrl || img?.url || '').trim())
    .filter((url) => /^data:image\//i.test(url))
    .slice(0, 4);

  if (!list.length) return '';

  const folderId = await getKonstanciaYandexFolderId();
  const key = String(apiKey || process.env.KONSTANCIA_YANDEX_API_KEY || '').trim();
  if (!key || !folderId) return '';

  const blocks = [];
  for (let i = 0; i < list.length; i += 1) {
    try {
      const { ocr, labels } = await analyzeOneImage(list[i], { apiKey: key, folderId });
      const name = String(images[i]?.filename || `изображение ${i + 1}`).trim();
      const lines = [];
      if (ocr.length) lines.push(`Распознанный текст: ${ocr.join('; ')}`);
      if (labels.length) lines.push(`Метки: ${labels.join(', ')}`);
      if (!lines.length) lines.push('Текст на изображении не распознан.');
      blocks.push(`Изображение «${name}»:\n${lines.join('\n')}`);
    } catch (err) {
      blocks.push(`Изображение ${i + 1}: не удалось проанализировать (${err?.message || err}).`);
    }
  }

  if (!blocks.length) return '';

  return [
    'Автоанализ прикреплённых изображений (Yandex Vision):',
    ...blocks,
    'Ответь на вопрос пользователя, опираясь на этот анализ. Не предлагай другие модели или сервисы.',
  ].join('\n\n');
}
