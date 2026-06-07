/** User-facing Konstancia LLM errors — never dump PyTorch stderr into chat. */

export function formatKonstanciaLlmError(raw) {
  const msg = String(raw || '').trim();
  if (!msg) return 'Konstancia не смогла ответить. Попробуйте ещё раз.';

  if (/size mismatch|copying a param with shape|shape in current model/i.test(msg)) {
    return 'Konstancia не смогла загрузить локальную модель. Перезапустите приложение или повторите запрос.';
  }

  if (/cuda|out of memory|oom/i.test(msg)) {
    return 'Konstancia не смогла ответить из-за нехватки памяти. Повторите запрос позже.';
  }

  if (/timeout|Konstancia LLM timeout/i.test(msg)) {
    return 'Konstancia долго думала и не успела ответить. Первый запуск после старта может занять несколько минут — повторите короче.';
  }

  if (msg.length > 280 || /traceback|File "|torch\.|transformers\./i.test(msg)) {
    return 'Konstancia не смогла ответить. Попробуйте ещё раз или перезапустите приложение.';
  }

  return msg;
}

/** Strip stale GigaChat fallbacks from Konstancia replies (local model / old training). */
export function sanitizeKonstanciaReply(text) {
  let msg = String(text || '').trim();
  if (!msg) return msg;

  if (/переключитесь на GigaChat|GigaChat vision|GigaChat-2|без vision/i.test(msg)) {
    msg = msg
      .replace(/[.\s]*—?\s*опишите картинку текстом или переключитесь на GigaChat\.?/gi, '')
      .replace(/переключитесь на GigaChat\.?/gi, '')
      .replace(/Локальная Konstancia пока без vision[^.]*\.?/gi, '')
      .trim();
  }

  return msg || 'Не удалось разобрать изображение — опишите, что на нём, своими словами.';
}
