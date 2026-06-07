/** Промпты и дополнения для отправки в Figma Make из Konstancia. */

export const FIGMA_MAKE_ENHANCEMENTS = [
  {
    id: 'mobile',
    label: 'Добавить mobile-версию',
    instruction: 'Добавь отдельные mobile-экраны 390×844 с адаптивной вёрсткой и touch-friendly контролами.',
  },
  {
    id: 'dark',
    label: 'Добавить тёмную тему',
    instruction: 'Добавь dark mode: тёмные поверхности, контрастный текст, сохрани акцентные цвета.',
  },
  {
    id: 'states',
    label: 'Добавить состояния UI',
    instruction: 'Добавь empty, loading, error, hover и focus состояния для ключевых компонентов и форм.',
  },
  {
    id: 'shkf',
    label: 'Стиль SHKF Studio',
    instruction: 'Примени дизайн-систему SHKF Studio: фон #FAFAF8, акцент #F97316, Inter, pill-кнопки, radius 12–16px.',
  },
  {
    id: 'accessibility',
    label: 'Улучшить доступность',
    instruction: 'Добавь требования a11y: контраст WCAG AA, focus rings, размеры tap-target 44px, aria-labels.',
  },
  {
    id: 'content',
    label: 'Добавить реальный контент',
    instruction: 'Замени placeholder-тексты на правдоподобный русский контент по теме, с заголовками, CTA и метриками.',
  },
];

export const FIGMA_MAKE_BUILDER_PROMPT = `Ты готовишь детальный промпт для Figma Make (текст → UI-макет).

По задаче Redmine и/или запросу пользователя:
1. Определи тип интерфейса (mobile onboarding, dashboard, landing, modal и т.д.).
2. Опиши экраны, компоненты, layout, типографику, цвета и состояния.
3. Строго опирайся на текст задачи — не выдумывай бренды и функции, которых нет в запросе.
4. Если задачи нет — возьми всё из сообщения пользователя.

Промпт должен быть на русском, структурированным, готовым для вставки в Figma Make.
Можно использовать секции ===, списки экранов, палитру, запреты (generic UI, purple gradients и т.п.).

Ответь КРАТКО для пользователя (2–4 предложения): что взял из задачи и что будет в макете.
Затем верни ТОЛЬКО готовый промпт в блоке:
<<<MAKE_PROMPT
...полный текст промпта...
MAKE_PROMPT>>>

Не добавляй FOLLOWUPS.`;

export const FIGMA_MAKE_ENHANCE_PROMPT = `Ты дополняешь уже готовый промпт для Figma Make.

На входе — базовый промпт и инструкция, что добавить.
Сохрани структуру и смысл базового промпта, интегрируй дополнение органично, без дублирования.

Ответь КРАТКО (1–2 предложения): что добавлено.
Затем верни обновлённый промпт в блоке:
<<<MAKE_PROMPT
...полный обновлённый промпт...
MAKE_PROMPT>>>`;

const MAKE_WORD_RE = /\bfigma\s*make\b|\bфигма\s*мэйк\b|\bmake\s*it\b/i;
const SEND_WORD_RE = /(?:отправ|закин|открой|запуст|сформируй|сделай|собери|сгенериру|создай|промпт|макет|в\s+make)/i;
const QUESTION_RE = /^(?:что|кто|как|зачем|почему|объясни|расскажи|чем\s+отлича)/i;

export function isFigmaMakeSendIntent(text, quickMakeText = '') {
  const t = String(text || '').trim();
  if (!t) return false;
  if (quickMakeText && t === quickMakeText) return true;
  if (QUESTION_RE.test(t)) return false;
  if (/^\/make\b/i.test(t)) return true;
  if (!MAKE_WORD_RE.test(t)) return false;
  if (SEND_WORD_RE.test(t)) return true;
  if (/\bfigma\s*make\b/i.test(t) && t.length <= 140) return true;
  return false;
}

export function extractMakePrompt(raw) {
  const body = String(raw || '');
  const match = body.match(/<<<MAKE_PROMPT\s*([\s\S]*?)\s*MAKE_PROMPT>>>/i);
  if (match) {
    return {
      prompt: match[1].trim(),
      summary: body.slice(0, match.index).trim(),
    };
  }
  return { prompt: null, summary: body.trim() };
}

export function buildMakeBuilderUserMessage({ userMessage, task }) {
  const parts = [];
  if (task?.id) {
    parts.push(
      'Есть задача Kanban/Redmine — прочитай тему и описание.',
      `ID задачи: #${task.id}`,
      task.subject ? `Тема задачи: ${task.subject}` : '',
    );
  } else {
    parts.push('Задачи нет — опирайся на запрос пользователя.');
  }
  parts.push('', `Запрос пользователя: ${String(userMessage || '').trim()}`);
  return parts.filter(Boolean).join('\n');
}

export function buildMakeEnhanceUserMessage({ basePrompt, enhancement, userMessage }) {
  return [
    'Базовый промпт для Figma Make:',
    '---',
    String(basePrompt || '').trim(),
    '---',
    '',
    `Дополнение: ${enhancement?.instruction || ''}`,
    userMessage ? `Контекст запроса: ${String(userMessage).trim()}` : '',
  ].filter(Boolean).join('\n');
}
