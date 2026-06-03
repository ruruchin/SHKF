/** Prompts and parsers for multi-page site/app codegen guided by Mobbin references. */

const SITE_BUILD_BLOCK_RE = /<<<SITE_BUILD_JSON\s*([\s\S]*?)\s*SITE_BUILD_JSON>>>/i;

export const SITE_BUILD_INTENT_RE = /(?:сверст|верст|собери|сделай|создай|напиши|build|scaffold|generate).{0,40}(?:сайт|website|лендинг|landing|веб.?прилож|web\s*app|приложени[ея]|dashboard|админк|портал|многостранич|multi.?page)|(?:сайт|website|лендинг|landing|веб.?прилож|react\s*app|next\.?js).{0,40}(?:сверст|верст|собери|сделай|создай|напиши)/i;

export const SITE_BUILD_SYSTEM_PROMPT = `Ты — senior front-end разработчик и продуктовый дизайнер в FIRURU.
Твоя задача: по запросу пользователя и блоку Mobbin/design reference signals собрать **готовый многостраничный прототип** (сайт или web-приложение).

Правила:
- Отвечай на русском в summary и assumptions; код и имена компонентов — на английском.
- Опирайся на reference signals: типографика, сетка, навигация, карточки, таблицы, формы, empty states — как у сильных SaaS (Linear, Notion, Attio tier), без generic «AI slop».
- Минимум 3 страницы для «приложения», минимум 1 лендинг + внутренние страницы для «сайта продукта».
- Стек по умолчанию: React 18 + Vite, чистый CSS (или CSS modules), react-router-dom для навигации. Без тяжёлых UI-kit, если пользователь не просит иное.
- Каждая страница — отдельный route; общий layout (header/sidebar/footer) вынеси в компонент.
- Реалистичный контент на русском (заголовки, CTA, плейсхолдеры данных), не lorem ipsum.
- Адаптив: desktop-first 1280+, breakpoint ~768px.
- Доступность: семантика, focus states, контраст кнопок.

Формат ответа — ТОЛЬКО JSON в блоке (без markdown снаружи):
<<<SITE_BUILD_JSON
{
  "summary": "что собрано",
  "assumptions": ["..."],
  "stack": "react-vite",
  "pages": [
    { "route": "/", "name": "Home", "purpose": "..." }
  ],
  "designTokens": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "radius": "12px",
    "accent": "#6E56CF",
    "background": "#FFFCF7",
    "text": "#201A16"
  },
  "files": [
    { "path": "src/App.jsx", "content": "полный файл" }
  ]
}
SITE_BUILD_JSON>>>

files должен включать всё необходимое для запуска: package.json, index.html, main.jsx, App.jsx, router, страницы, styles.css, README с npm install && npm run dev.`;

export function isSiteBuildIntent(text) {
  return SITE_BUILD_INTENT_RE.test(String(text || '').trim());
}

function normalizeJsonText(text) {
  return String(text || '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function tryParseSiteBuildPayload(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const attempts = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) attempts.push(jsonMatch[0]);

  for (const chunk of attempts) {
    try {
      const parsed = JSON.parse(normalizeJsonText(chunk));
      if (parsed && Array.isArray(parsed.files) && parsed.files.length) return parsed;
    } catch { /* next */ }
  }
  return null;
}

export function extractSiteBuildPlan(content) {
  const text = String(content || '').trim();
  const block = text.match(SITE_BUILD_BLOCK_RE);
  if (block?.[1]) {
    const plan = tryParseSiteBuildPayload(block[1]);
    if (plan) return plan;
  }
  return tryParseSiteBuildPayload(text);
}

export function buildSiteBuilderUserMessage({ message, refsContext, taskContext }) {
  const parts = [];
  if (taskContext) parts.push(taskContext, '');
  if (refsContext) parts.push(refsContext, '');
  parts.push('---', '', '**Запрос пользователя:**', String(message || '').trim());
  return parts.join('\n');
}
