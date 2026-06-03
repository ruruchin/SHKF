/** Blueprint: pages + section blocks (no full file bodies from LLM). */

export const SECTION_TYPES = [
  'hero',
  'split-hero',
  'auth-panel',
  'stat-row',
  'card-grid',
  'data-table',
  'chart-panel',
  'profile-header',
  'settings-form',
  'onboarding-steps',
  'pricing-cards',
  'faq',
  'cta-band',
  'empty-state',
  'logo-strip',
  'testimonial',
  'timeline',
];

const PAGE_PRESETS = {
  home: {
    route: '/',
    name: 'Главная',
    sections: [
      { type: 'hero', title: 'Инвестиции без лишней сложности', subtitle: 'Портфель, аналитика и сделки в одном приложении', primaryCta: 'Начать', secondaryCta: 'Войти' },
      { type: 'stat-row', stats: [{ label: 'Активы под управлением', value: '₽12.4 млрд' }, { label: 'Пользователей', value: '840K+' }, { label: 'Средняя доходность', value: '11.2%' }] },
      { type: 'card-grid', title: 'Возможности', items: [{ title: 'Портфель', text: 'Акции, облигации и фонды в едином экране' }, { title: 'Аналитика', text: 'Графики, сценарии и риск-профиль' }, { title: 'Безопасность', text: '2FA, биометрия и уведомления' }] },
      { type: 'cta-band', title: 'Откройте счёт за 5 минут', text: 'Без бумажной волокиты — только паспорт и телефон', cta: 'Зарегистрироваться' },
    ],
  },
  login: {
    route: '/login',
    name: 'Вход',
    sections: [
      { type: 'auth-panel', mode: 'login', title: 'С возвращением', subtitle: 'Войдите, чтобы увидеть портфель' },
      { type: 'logo-strip', logos: ['Bloomberg', 'MOEX', 'Сбер', 'Тинькофф'] },
    ],
  },
  register: {
    route: '/register',
    name: 'Регистрация',
    sections: [
      { type: 'split-hero', title: 'Создайте аккаунт', subtitle: 'Onboarding за 3 шага — как в лучших fintech-приложениях', primaryCta: 'Продолжить' },
      { type: 'onboarding-steps', steps: ['Телефон', 'Паспорт', 'Риск-профиль'], active: 0 },
      { type: 'auth-panel', mode: 'register', title: 'Ваши данные', subtitle: 'Мы не передаём информацию третьим лицам' },
    ],
  },
  profile: {
    route: '/profile',
    name: 'Профиль',
    sections: [
      { type: 'profile-header', name: 'Алексей Иванов', role: 'Инвестор · Premium', email: 'alexey@example.com' },
      { type: 'settings-form', title: 'Настройки аккаунта', fields: ['Имя', 'Email', 'Телефон', 'Уведомления'] },
      { type: 'card-grid', title: 'Подписки', items: [{ title: 'Premium', text: 'Расширенная аналитика' }, { title: 'Pro', text: 'API и отчёты' }] },
    ],
  },
  analytics: {
    route: '/investments-analysis',
    name: 'Аналитика',
    sections: [
      { type: 'hero', title: 'Аналитика портфеля', subtitle: 'Доходность, риск и распределение активов', primaryCta: 'Экспорт PDF', secondaryCta: 'Сравнить' },
      { type: 'chart-panel', title: 'Динамика портфеля', period: '12 мес' },
      { type: 'data-table', title: 'Позиции', columns: ['Актив', 'Доля', 'P/L', 'Риск'], rows: [['SBER', '18%', '+4.2%', 'Низкий'], ['FXRL', '12%', '+1.1%', 'Средний'], ['OFZ', '25%', '+0.8%', 'Низкий']] },
      { type: 'stat-row', stats: [{ label: 'YTD', value: '+11.4%' }, { label: 'Волатильность', value: '8.2%' }, { label: 'Beta', value: '0.94' }] },
    ],
  },
  dashboard: {
    route: '/dashboard',
    name: 'Дашборд',
    sections: [
      { type: 'stat-row', stats: [{ label: 'Портфель', value: '₽1.24M' }, { label: 'За день', value: '+₽12 400' }, { label: 'Кэш', value: '₽84 200' }] },
      { type: 'chart-panel', title: 'Динамика', period: '30 дней' },
      { type: 'data-table', title: 'Последние сделки', columns: ['Дата', 'Тикер', 'Тип', 'Сумма'], rows: [['03.06', 'SBER', 'Buy', '₽42 000'], ['02.06', 'FXRL', 'Sell', '₽18 500']] },
    ],
  },
  pricing: {
    route: '/pricing',
    name: 'Тарифы',
    sections: [
      { type: 'hero', title: 'Тарифы для любого этапа', subtitle: 'От старта до команды', primaryCta: 'Выбрать план' },
      { type: 'pricing-cards', plans: [{ name: 'Start', price: '₽0', features: ['1 портфель', 'Базовая аналитика'] }, { name: 'Pro', price: '₽990/мес', features: ['5 портфелей', 'Экспорт', 'Алерты'], highlight: true }, { name: 'Team', price: '₽4 990/мес', features: ['Безлимит', 'API', 'SSO'] }] },
      { type: 'faq', items: [{ q: 'Можно отменить?', a: 'Да, в любой момент из профиля.' }, { q: 'Есть пробный период?', a: '14 дней Pro без карты.' }] },
    ],
  },
  settings: {
    route: '/settings',
    name: 'Настройки',
    sections: [
      { type: 'settings-form', title: 'Общие', fields: ['Язык', 'Валюта', 'Часовой пояс'] },
      { type: 'settings-form', title: 'Безопасность', fields: ['2FA', 'Биометрия', 'Сессии'] },
    ],
  },
  onboarding: {
    route: '/onboarding',
    name: 'Онбординг',
    sections: [
      { type: 'onboarding-steps', steps: ['Цели', 'Риск', 'Пополнение'], active: 1 },
      { type: 'card-grid', title: 'Выберите цель', items: [{ title: 'Рост', text: 'Акции и фонды' }, { title: 'Сохранность', text: 'Облигации' }, { title: 'Смешанная', text: 'Баланс' }] },
      { type: 'cta-band', title: 'Готово к первому пополнению?', text: 'Минимум ₽1 000', cta: 'Пополнить' },
    ],
  },
};

function slugRoute(route) {
  if (!route || route === '/') return 'home';
  return String(route).replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() || 'page';
}

function componentNameFromRoute(route) {
  const slug = slugRoute(route);
  return slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('') + 'Page';
}

export function inferBlueprintFromMessage(message, refs = []) {
  const text = String(message || '').toLowerCase();
  const productName = extractProductName(message) || 'Продукт';
  const pages = [];
  const used = new Set();

  const addPreset = (key) => {
    if (used.has(key) || !PAGE_PRESETS[key]) return;
    used.add(key);
    pages.push({ ...PAGE_PRESETS[key], id: key });
  };

  if (/инвест|fintech|portfolio|портфел|брокер|акци|trading|трейдинг/.test(text)) {
    ['home', 'login', 'register', 'onboarding', 'profile', 'analytics'].forEach(addPreset);
  }
  if (/onboarding|онбординг/.test(text)) addPreset('onboarding');
  if (/login|вход|sign\s*in|авториз/.test(text)) addPreset('login');
  if (/register|регистрац|sign\s*up|создай.*аккаунт/.test(text)) addPreset('register');
  if (/profile|профил|личн|кабинет|account/.test(text)) addPreset('profile');
  if (/analyt|аналит|invest|инвест|chart|график/.test(text)) addPreset('analytics');
  if (/dashboard|дашборд|панель/.test(text)) addPreset('dashboard');
  if (/pricing|тариф|price|цены/.test(text)) addPreset('pricing');
  if (/settings|настройк/.test(text)) addPreset('settings');

  if (!pages.length || /лендинг|landing|главн|home|marketing|сайт/.test(text)) {
    addPreset('home');
  }
  if (pages.length < 3) {
    addPreset('login');
    addPreset('register');
    addPreset('profile');
    addPreset('analytics');
  }

  const appPages = pages.filter((p) => !['home', 'pricing'].includes(p.id));
  const layout = appPages.length >= 2 ? 'sidebar' : 'top-nav';
  const appType = /лендинг|landing|marketing|сайт компани/.test(text) && appPages.length < 2
    ? 'marketing-site'
    : 'saas-app';

  const tags = new Set();
  for (const ref of refs || []) {
    for (const tag of (ref.tags || [])) tags.add(String(tag).toLowerCase());
  }
  const fintech = tags.has('fintech') || /инвест|fintech|банк|portfolio|портфел/.test(text);
  const tokens = fintech
    ? { accent: '#0F766E', accentSoft: '#CCFBF1', background: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A', muted: '#64748B', radius: '14px' }
    : { accent: '#6E56CF', accentSoft: '#EEE8FF', background: '#FFFCF7', surface: '#FFFFFF', text: '#201A16', muted: '#6B6560', radius: '12px' };

  return {
    productName,
    appType,
    layout,
    tokens,
    pages: pages.slice(0, 8),
  };
}

function extractProductName(message) {
  const m = String(message || '').match(/(?:для|про|о)\s+([^,.!?\n]{3,48})/i);
  if (m?.[1]) return m[1].trim();
  const m2 = String(message || '').match(/([A-ZА-Я][\wа-яА-ЯёЁ\-]{2,24}(?:\s+[A-ZА-Я][\wа-яА-ЯёЁ\-]{2,24})?)/);
  return m2?.[1]?.trim() || null;
}

export const BLUEPRINT_SYSTEM_PROMPT = `Ты планируешь структуру многостраничного web-приложения (НЕ пишешь код файлов).
Верни ТОЛЬКО JSON в блоке:
<<<SITE_BLUEPRINT_JSON
{
  "productName": "Название",
  "appType": "saas-app|marketing-site",
  "layout": "sidebar|top-nav",
  "tokens": { "accent": "#hex", "background": "#hex", "text": "#hex", "muted": "#hex", "radius": "12px" },
  "pages": [
    {
      "route": "/login",
      "name": "Вход",
      "sections": [
        { "type": "auth-panel", "mode": "login", "title": "...", "subtitle": "..." },
        { "type": "card-grid", "title": "...", "items": [{ "title": "...", "text": "..." }] }
      ]
    }
  ]
}
SITE_BLUEPRINT_JSON>>>

Допустимые type секций: ${SECTION_TYPES.join(', ')}.
Минимум 4 страницы для приложения. Каждая страница — 2–5 секций разного типа (не только hero).
Опирайся на Mobbin reference signals в запросе.`;

const BLUEPRINT_BLOCK_RE = /<<<SITE_BLUEPRINT_JSON\s*([\s\S]*?)\s*SITE_BLUEPRINT_JSON>>>/i;

function normalizeJsonText(text) {
  return String(text || '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

export function extractBlueprint(content) {
  const text = String(content || '').trim();
  const block = text.match(BLUEPRINT_BLOCK_RE);
  const raw = block?.[1] || text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(normalizeJsonText(jsonMatch[0]));
    if (!Array.isArray(parsed.pages) || !parsed.pages.length) return null;
    return normalizeBlueprint(parsed);
  } catch {
    return null;
  }
}

export function normalizeBlueprint(raw) {
  const pages = (raw.pages || []).slice(0, 10).map((page, idx) => {
    const route = String(page.route || `/page-${idx + 1}`).trim();
    const sections = (page.sections || []).filter((s) => s && SECTION_TYPES.includes(s.type));
    if (!sections.length) {
      sections.push({ type: 'hero', title: page.name || 'Страница', subtitle: 'Описание раздела', primaryCta: 'Действие' });
    }
    return {
      route: route.startsWith('/') ? route : `/${route}`,
      name: String(page.name || route).trim() || route,
      sections: sections.slice(0, 6),
      id: slugRoute(route),
    };
  });
  return {
    productName: String(raw.productName || 'Продукт').trim(),
    appType: raw.appType === 'marketing-site' ? 'marketing-site' : 'saas-app',
    layout: raw.layout === 'top-nav' ? 'top-nav' : 'sidebar',
    tokens: { ...inferBlueprintFromMessage('').tokens, ...(raw.tokens || {}) },
    pages,
  };
}

export { slugRoute, componentNameFromRoute, PAGE_PRESETS };
