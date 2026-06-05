/**
 * Извлекает поисковый запрос для Mobbin API из свободного текста пользователя.
 * Убирает команды («собери макет», «figma») и оставляет тему продукта.
 */

const STOP_WORDS = new Set([
  'собери', 'сделай', 'создай', 'нужен', 'нужно', 'хочу', 'можешь', 'пожалуйста',
  'макет', 'макеты', 'прототип', 'прототипы', 'figma', 'фигма', 'фигме', 'экран', 'экраны',
  'страниц', 'страницы', 'страницу', 'приложение', 'приложения', 'приложении', 'сайт', 'сайта',
  'многостраничный', 'многостраничное', 'верстка', 'верстку', 'дизайн', 'ui', 'ux', 'kit',
  'как', 'в', 'на', 'по', 'для', 'из', 'и', 'или', 'the', 'a', 'an', 'to', 'for', 'with',
  'build', 'make', 'create', 'design', 'mockup', 'wireframe', 'screen', 'screens', 'page', 'pages',
  'app', 'mobile', 'web', 'ios', 'android', 'прям', 'прямо', 'очень', 'хороший', 'качественный',
  'референс', 'референсы', 'mobbin', 'моббин', 'похожий', 'похожая', 'похожее', 'типа', 'типу',
]);

const TOPIC_HINTS = [
  { re: /инвест|fintech|брокер|портфел|portfolio|trading|трейдинг|акци|облигац/i, terms: ['fintech investment app portfolio trading'] },
  { re: /банк|banking|карт|wallet|кошелек|платеж|payment/i, terms: ['banking wallet payments app'] },
  { re: /onboarding|онбординг/i, terms: ['onboarding flow signup'] },
  { re: /login|вход|sign\s*in|авториз/i, terms: ['login sign in authentication'] },
  { re: /register|регистрац|sign\s*up/i, terms: ['sign up registration create account'] },
  { re: /dashboard|дашборд|аналит|analytics|chart|график/i, terms: ['dashboard analytics charts'] },
  { re: /e-?commerce|магазин|shop|checkout|корзин/i, terms: ['ecommerce shopping checkout'] },
  { re: /saas|b2b|crm|admin/i, terms: ['saas b2b dashboard'] },
  { re: /health|медицин|wellness|фитнес/i, terms: ['health fitness wellness app'] },
  { re: /social|чат|messenger|сообщен/i, terms: ['social messaging chat app'] },
  { re: /education|обучен|курс|learning/i, terms: ['education learning app'] },
  { re: /travel|бронирован|отель|booking/i, terms: ['travel booking app'] },
  { re: /food|доставк|ресторан|delivery/i, terms: ['food delivery restaurant app'] },
  { re: /crypto|крипт|bitcoin|биткоин/i, terms: ['crypto wallet trading app'] },
];

function tokenizeWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * @param {string} message
 * @returns {string}
 */
/** Теги темы для сопоставления с локальной библиотекой референсов */
export function topicTagsFromQuery(message) {
  const tags = new Set();
  const raw = String(message || '');
  for (const { re, terms } of TOPIC_HINTS) {
    if (!re.test(raw)) continue;
    for (const term of terms) {
      for (const word of term.split(/\s+/)) {
        if (word.length >= 3) tags.add(word.toLowerCase());
      }
    }
  }
  for (const word of tokenizeWords(raw)) tags.add(word);
  return [...tags];
}

const MOBBIN_PLATFORM_WEB_RE = /\b(web|website|веб(?:-сайт)?|сайт|лендинг|landing(?:\s*page)?|desktop|браузер|browser|портал|www\.|homepage|дашборд\s+web)\b/i;
const MOBBIN_PLATFORM_IOS_RE = /\b(ios|iphone|ipad|android|мобильн|mobile\s*app|приложени[ея]|native\s*app|app\s*store|смартфон|телефон|мобилк)\b/i;

/**
 * Платформа Mobbin API: ios (мобильные экраны) или web.
 * @param {string} message
 * @returns {'ios'|'web'}
 */
export function inferMobbinPlatform(message) {
  const text = String(message || '').toLowerCase();
  const wantsWeb = MOBBIN_PLATFORM_WEB_RE.test(text);
  const wantsMobile = MOBBIN_PLATFORM_IOS_RE.test(text);

  if (wantsWeb && !wantsMobile) return 'web';
  if (wantsMobile && !wantsWeb) return 'ios';
  if (wantsWeb && wantsMobile) {
    if (/мобильн|mobile\s*app|приложени[ея]|iphone|android|мобилк/i.test(text)) return 'ios';
    return 'web';
  }
  if (/приложени[ея]|mobile\s*app|\bmobile\b/i.test(text)) return 'ios';
  if (/\b(сайт|website|лендинг|landing)\b/i.test(text)) return 'web';
  return 'ios';
}

export function mobbinPlatformLabel(platform) {
  return platform === 'web' ? 'web' : 'iOS';
}

export function mobbinSearchQuerySuffix(platform) {
  return platform === 'web' ? 'website web ui' : 'mobile app screen ui';
}

export function extractMobbinSearchQuery(message) {
  const raw = String(message || '').trim();
  if (!raw) return 'mobile app ui';

  const hints = [];
  for (const { re, terms } of TOPIC_HINTS) {
    if (re.test(raw)) hints.push(...terms);
  }

  const words = tokenizeWords(raw);
  const unique = [...new Set([...hints, ...words])].slice(0, 12);

  if (unique.length >= 2) {
    return unique.join(' ').slice(0, 500);
  }

  if (hints.length) return hints.slice(0, 6).join(' ').slice(0, 500);

  return raw
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 8)
    .join(' ')
    .trim()
    .slice(0, 500) || 'mobile app ui';
}
