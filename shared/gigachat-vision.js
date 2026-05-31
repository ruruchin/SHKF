/** Модели GigaChat с поддержкой изображений (Files API + attachments). */

const VISION_MODEL_RE = /^GigaChat-2(-Pro)?$/i;

export function isGigaChatVisionModel(model) {
  return VISION_MODEL_RE.test(String(model || '').trim());
}

export const GIGACHAT_VISION_HINT =
  'Изображения в чате поддерживают модели GigaChat-2 и GigaChat-2-Pro. Переключите модель в шапке агента.';

export const MAX_AGENT_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_AGENT_IMAGES_PER_MESSAGE = 1;
