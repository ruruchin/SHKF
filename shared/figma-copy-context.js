/**
 * Язык и копирайт для макетов — не копировать бренд Mobbin (Revolut и т.д.).
 */

const CYRILLIC_RE = /[\u0400-\u04FF]/;

const BRAND_STOP = new Set([
  'revolut', 'monzo', 'n26', 'robinhood', 'coinbase', 'stripe', 'wise', 'paypal',
  'mobbin', 'figma', 'ios', 'android',
]);

/**
 * @param {string} message
 * @returns {'ru'|'en'}
 */
export function inferUiLanguage(message) {
  const text = String(message || '');
  if (CYRILLIC_RE.test(text)) return 'ru';
  return 'en';
}

/**
 * @param {string} message
 * @returns {string|null}
 */
export function inferProductName(message) {
  const text = String(message || '').trim();
  if (!text) return null;

  const quoted = text.match(/[«"]([^»"]{2,40})[»"]/);
  if (quoted?.[1]) return quoted[1].trim();

  const forApp = text.match(
    /(?:для|под|приложени[ея]|сервис|бренд|названи[ея])\s+([A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9\s-]{1,28})/i,
  );
  if (forApp?.[1]) return forApp[1].trim();

  const latin = text.match(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/);
  if (latin?.[1] && !BRAND_STOP.has(latin[1].toLowerCase())) return latin[1];

  if (/инвест|invest/i.test(text)) return 'InvestClub';
  if (/банк|bank/i.test(text)) return 'MyBank';
  return null;
}

/**
 * @param {string} message
 * @param {object} [screen]
 */
export function buildMobbinCopyRules(message, screen = null) {
  const lang = inferUiLanguage(message);
  const product = inferProductName(message);
  const refApp = screen?.app_name || screen?.title || 'Mobbin';

  const lines = [
    lang === 'ru'
      ? 'Все подписи UI — на русском (кнопки, заголовки, поля, таб-бар).'
      : 'All UI copy in English.',
    `Mobbin «${refApp}» — ТОЛЬКО композиция, отступы, цвета, размеры. НЕ копируй название бренда с референса (Revolut, Monzo и т.п.).`,
  ];

  if (product) {
    lines.push(
      lang === 'ru'
        ? `Название продукта в текстах: «${product}». Заголовки/CTA под задачу пользователя, не слоганы чужого приложения.`
        : `Product name in UI copy: "${product}".`,
    );
  } else if (lang === 'ru') {
    lines.push('Придумай нейтральное русское название fintech-приложения (не Revolut).');
  }

  lines.push(
    'Запрещено: чёрный фон на весь экран, если на референсе светлый UI; круги/овалы как «иллюстрация»; кнопки-шарики; текст поверх чужих фреймов на странице.',
    'Обязательно: светлые карточки, нормальные поля ввода и кнопки, иллюстрации — отдельный frame с imagePrompt, не примитивы.',
  );

  return lines;
}
