/** Промпт для генерации баннеров через NanoBanana. */

export const BANNER_NB_PROMPT_RULES = `Продумывай объекты под тему. Если тема недвижимости — дома, если тема IT — ноутбук и т.д.

На баннерах не должно быть надписей на любых языках.

Не подходящие под тему элементы не стоит вставлять. Элементов на картинке должно быть максимум 3 шт.

Чуть измени композицию для этого изображения, чтобы они не повторялись.
Фон нужно изменить по цвету. Важно, чтобы баннер был таким, как на изображении, с заменёнными предметами и чуть изменённым положением предметов. Сделай это в 3D-стиле, но не фотореализм.

Фон должен быть строго чисто белым (#FFFFFF), без градиента, без шума, без текстуры и без серого оттенка.
Никаких цветных подложек, теней фона и фоновых декоративных элементов.

Если в баннере есть цена/сумма/платёж, используй только российскую валюту: ₽, руб., рублей (RUB). Не используй $, €, £ и другие валюты.`;

export function buildBannerNanobananaPrompt({ topic, elementsDescription }) {
  const theme = String(topic || 'баннер').trim();
  const elements = String(elementsDescription || '').trim()
    || 'Подбери до 3 предметов, которые лучше всего раскрывают тему.';

  return `Нужно чтобы ты сгенерировал изображение в точно таком же стиле но на тему -
[ ${theme} ].

( ${elements} )

${BANNER_NB_PROMPT_RULES}`;
}

export const BANNER_NANOBANANA_BUILDER_PROMPT = `Ты готовишь промпт для генерации баннера в сервисе NanoBanana (текст-to-image).

Твоя задача — по описанию задачи Redmine и/или запросу пользователя:
1. Вычленить тему баннера (например «Образовательный кредит», «Ипотека», «IT-курс»).
2. Кратко назвать баннер, если есть в задаче (формат «сделать баннер: …»).
3. Подобрать до 3 предметов на баннере, строго по теме.
4. Собрать ИТОГОВЫЙ промпт на русском языке по шаблону ниже.

Шаблон (сохрани структуру и все правила из блока правил):
---
Нужно чтобы ты сгенерировал изображение в точно таком же стиле но на тему -
[ ТЕМА ].

( ОПИСАНИЕ ЭЛЕМЕНТОВ — 1–3 предмета, без текста на картинке )

${BANNER_NB_PROMPT_RULES}
---

Ответь КРАТКО для пользователя (2–4 предложения): что взял из задачи, тема, какие объекты.
Затем на отдельной строке верни ТОЛЬКО готовый промпт для NanoBanana в блоке:
<<<NB_PROMPT
...полный текст промпта...
NB_PROMPT>>>

Не добавляй FOLLOWUPS. Не выдумывай требования, которых нет в задаче.`;

const NB_WORD_RE = /(?:nano\s*banana|nanobanana|нанобанан|нанобанана)/i;
const BANNER_WORD_RE = /(?:баннер|banner)/i;
const GENERATE_WORD_RE = /сгенерир(?:уй|ируй)|генерир(?:уй|ируй)|сделай|создай|нарисуй|выдай|собери/i;
const PROMPT_WORD_RE = /\bпромпт\b|prompt/i;

export function isBannerNanobananaIntent(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  const hasNb = NB_WORD_RE.test(t);
  const hasBanner = BANNER_WORD_RE.test(t);
  const hasGenerate = GENERATE_WORD_RE.test(t);
  const hasPromptWord = PROMPT_WORD_RE.test(t);

  if (hasNb && hasBanner) return true;
  if (!hasNb) {
    if (hasPromptWord) return false;
    if (hasBanner && hasGenerate) return true;
  }
  return false;
}

export function extractNanobananaPrompt(raw) {
  const body = String(raw || '');
  const match = body.match(/<<<NB_PROMPT\s*([\s\S]*?)\s*NB_PROMPT>>>/i);
  if (match) {
    return {
      prompt: match[1].trim(),
      summary: body.slice(0, match.index).trim(),
    };
  }
  return { prompt: null, summary: body.trim() };
}

export function buildBannerBuilderUserMessage({ userMessage, task }) {
  const parts = [];
  if (task?.id) {
    parts.push(
      'Есть задача Kanban/Redmine — прочитай тему и описание, вычлени тему баннера и объекты.',
      `ID задачи: #${task.id}`,
      task.subject ? `Тема задачи: ${task.subject}` : '',
    );
  } else {
    parts.push('Задачи нет — тему и объекты возьми из запроса пользователя.');
  }
  parts.push('', `Запрос пользователя: ${String(userMessage || '').trim()}`);
  return parts.filter(Boolean).join('\n');
}
