/** Модели GigaChat с поддержкой изображений (Files API + attachments). */

const VISION_MODEL_RE = /^GigaChat-2(-Pro|-Max)?$/i;

/** Lite — без Vision; макет Mobbin только по тексту (структурный JSON). */
const LITE_MODEL_IDS = new Set(['GigaChat', 'GigaChat-2-Lite']);

export function isGigaChatVisionModel(model) {
  return VISION_MODEL_RE.test(String(model || '').trim());
}

export function isGigaChatLiteModel(model) {
  return LITE_MODEL_IDS.has(String(model || '').trim());
}

/** Модель Lite для fallback при 402 на Pro/Max. */
export function defaultGigaChatLiteModel() {
  return 'GigaChat';
}

export const GIGACHAT_VISION_HINT =
  'Копия Mobbin по скриншоту: GigaChat-2, GigaChat-2-Pro или GigaChat-2-Max. Если токены Pro/Max закончились — выберите GigaChat (Lite): макет соберётся по тексту (без Vision).';

export const GIGACHAT_LITE_MOBBIN_HINT =
  'Режим Lite: без анализа скриншота Mobbin — структурный макет по вашему запросу и названию референса. Для копии 1:1 нужны токены Pro/Max.';

export const MAX_AGENT_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_AGENT_IMAGES_PER_MESSAGE = 4;
