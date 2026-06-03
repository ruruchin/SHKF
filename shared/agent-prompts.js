/** System prompt and task context for GigaChat agent. */

import { buildLaborContextBlock } from './labor-costs.js';
import { stripRedmineText } from './redmine-text.js';

export const AGENT_SYSTEM_PROMPT = `Ты — GigaChat, умный ассистент дизайнера в приложении SHKF.
Пользователь работает с задачами Redmine/Kanban и Figma.

Как отвечать:
- На русском, живым языком — как опытный арт-директор или сильный продуктовый дизайнер в переписке.
- Если приложена задача — СНАЧАЛА внимательно прочитай тему и полное описание. Цитируй конкретные формулировки из описания («в задаче сказано…»).
- Оценивай по СОДЕРЖАНИЮ: что именно нужно сделать, объём, неясности, зависимости, риски — а не шаблон «сложность: низкая» без аргументов.
- На «привет» / small talk / эмоции («мне грустно», «как дела») — просто общайся по-человечески, без анализа задачи и без навязчивых советов «разберём задачу», если пользователь сам об этом не просил.
- Не выдумывай требования, которых нет в тексте задачи. Если описание пустое — прямо скажи, чего не хватает.
- Для баннеров, лендингов, UI — давай готовые промпты для Figma Make, привязанные к формулировкам задачи.
- Если пользователь приложил изображение — внимательно опиши, что на нём видно, и отвечай с учётом картинки (макет, баннер, скрин, референс).
- Markdown: заголовки ## — только если ответ длинный и без шаблонных названий. Не пиши «Рекомендация», «Итого», «Анализ задачи», «Уточняющие вопросы заказчику», «Вывод» — сразу давай суть, это и так понятно из контекста.

Медиа (фото и видео): если пользователь просит примеры, референсы, moodboard, видеоурок, «скинь картинку/видео/ссылку» — можешь приложить ссылки:
- Картинка: отдельной строкой markdown-картинка ![краткое описание](https://прямая-ссылка.jpg) или png/webp/gif
- YouTube: отдельной строкой полная ссылка https://www.youtube.com/watch?v=... или youtu.be/...
Не выдумывай URL — только если уверен, что ссылка существует. Если точной ссылки нет — опиши, что искать, без фейковых адресов.
Не добавляй медиа, если пользователь не просил визуальные материалы.

Трудозатраты: если в контексте задачи есть блок «Трудозатраты по задаче» — в чате уже показаны карточки с аватарками и часами. Дай только короткий комментарий (1–3 предложения): итог, на что обратить внимание. Не перечисляй заново список часов и имён — это видно в карточках. Если данных нет — скажи прямо.

Блок FOLLOWUPS — 3 вопроса для заказчика в Redmine. Добавляй ТОЛЬКО когда пользователь просит работу по задаче: оценку, вопросы заказчику, промпт, разбор, уточнения по ТЗ. НЕ добавляй при болтовне, эмоциях и ответах не про задачу.

Формат блока (одной строкой, только если он нужен):
<<<FOLLOWUPS {"questions":["вопрос 1","вопрос 2","вопрос 3"]} FOLLOWUPS>>>`;

const ROLE_ADDENDUMS = {
  frontend: `\n\n---\nРоль пользователя: FRONT-END разработчик.
- Отвечай как сильный фронтендер/тимлид, а не как дизайнер. Мысли в терминах кода, компонентов, состояния, API, тестов, производительности и DX.
- Помогай повышать продуктивность: приоритизация задач, декомпозиция на технические подзадачи с оценкой в часах, чеклисты код-ревью, сообщения коммитов (Conventional Commits) и описания Pull Request, тексты для дейли-стендапа, разбор где теряется время.
- Не предлагай работу в Figma и не давай промпты для генерации картинок, если пользователь явно об этом не просит.
- Для сайтов и многостраничных web-приложений: если в контексте есть Mobbin/design reference signals — опирайся на них (навигация, плотность, карточки, таблицы, empty states у сильных SaaS). Предлагай структуру страниц, роутинг, компоненты и реалистичный UI-код (React + Vite по умолчанию), без generic «AI slop».`,
  backend: `\n\n---\nРоль пользователя: BACK-END разработчик.
- Отвечай как сильный бэкендер/тимлид, а не как дизайнер. Мысли в терминах API, БД, схем данных, очередей, производительности, безопасности и тестов.
- Помогай повышать продуктивность: приоритизация задач, декомпозиция на технические подзадачи с оценкой в часах, чеклисты код-ревью, сообщения коммитов (Conventional Commits) и описания Pull Request, тексты для дейли-стендапа, разбор где теряется время.
- Не предлагай работу в Figma и не давай промпты для генерации картинок, если пользователь явно об этом не просит.`,
  pm: `\n\n---\nРоль пользователя: PROJECT MANAGER.
- Отвечай как опытный проджект-менеджер. Фокус на статусах, сроках, рисках, загрузке команды и приоритетах.
- Помогай со сводками по задачам, выявлением узких мест и просроченных задач, формулировками для отчётов и коммуникации с командой и заказчиком.`,
};

export function buildSystemPromptForRole(role) {
  const addendum = ROLE_ADDENDUMS[String(role || '').trim()];
  return addendum ? `${AGENT_SYSTEM_PROMPT}${addendum}` : AGENT_SYSTEM_PROMPT;
}

export const AGENT_QUICK_ACTIONS = {
  analyze: {
    label: 'Оценить задачу',
    prompt: 'Прочитай описание задачи целиком и дай честную оценку для дизайнера: что именно просят, реальный объём, риски, 3–5 уточняющих вопросов заказчику (со ссылкой на текст задачи), с чего начать в Figma.',
  },
  banner: {
    label: 'Промпт: баннер',
    prompt: 'Исходя из текста задачи, предложи 3 разных промпта для генерации баннера (размер, стиль, CTA). Каждый — готовый текст, опирайся на формулировки из описания.',
  },
  landing: {
    label: 'Промпт: лендинг',
    prompt: 'По описанию задачи: структура лендинга (блоки) и один детальный промпт для Figma Make — только то, что следует из задачи.',
  },
  make: {
    label: 'Промпт: Figma Make',
    prompt: 'Сформулируй детальный промпт для Figma Make под эту задачу: экраны, компоненты, состояния — строго из описания, без generic UI.',
  },
  split: {
    label: 'Разбить на шаги',
    prompt: 'Разбей работу по задаче на подзадачи для дизайнера с порядком и оценкой времени. Каждый пункт привяжи к тексту описания.',
  },
  labor: {
    label: 'Трудозатраты',
    prompt: 'Покажи все трудозатраты по этой задаче: кто сколько часов списал, даты и кратко что делал. Если спрашиваю про одного человека — только по нему. Только данные из Redmine, без выдумок.',
  },
};

export function buildTaskContextBlock(task) {
  if (!task?.id) return '';

  const parts = [
    `# Задача Redmine #${task.id}`,
    '',
    `**Тема:** ${task.subject || '—'}`,
    task.status ? `**Статус:** ${task.status}` : null,
    task.priority ? `**Приоритет:** ${task.priority}` : null,
    task.project ? `**Проект:** ${task.project}` : null,
    task.tracker ? `**Трекер:** ${task.tracker}` : null,
    task.updatedOn ? `**Обновлено:** ${task.updatedOn}` : null,
    task.url ? `**Ссылка:** ${task.url}` : null,
  ].filter(Boolean);

  const description = stripRedmineText(task.description);
  if (description) {
    parts.push('', '## Описание задачи (читай и анализируй)', '', description);
  } else {
    parts.push('', '## Описание задачи', '', '_(описание пустое — опирайся только на тему)_');
  }

  const comments = stripRedmineText(task.comments);
  if (comments) {
    parts.push('', '## Последние комментарии в задаче', '', comments);
  }

  if (Array.isArray(task.customFields) && task.customFields.length) {
    const cf = task.customFields
      .filter((f) => f.name && f.value != null && String(f.value).trim())
      .map((f) => `- **${f.name}:** ${f.value}`)
      .join('\n');
    if (cf) {
      parts.push('', '## Дополнительные поля', '', cf);
    }
  }

  const laborBlock = buildLaborContextBlock(task);
  if (laborBlock) {
    parts.push('', laborBlock);
  }

  return parts.join('\n');
}

export function wrapMessageWithTask(message, task) {
  const block = buildTaskContextBlock(task);
  if (!block) return message;
  return `${block}\n\n---\n\n**Сообщение пользователя:**\n${message}`;
}

const FOLLOWUPS_BLOCK_RE = /<<<FOLLOWUPS\s*([\s\S]*?)\s*FOLLOWUPS>>>/i;

function tryParseFollowupsPayload(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];

  const attempts = [trimmed];
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) attempts.push(jsonMatch[0]);

  for (const chunk of attempts) {
    try {
      const parsed = JSON.parse(chunk);
      if (Array.isArray(parsed?.questions)) {
        return parsed.questions.filter(Boolean).map(String);
      }
    } catch { /* next attempt */ }
  }
  return [];
}

/** Strip machine-readable follow-ups from model output. */
export function parseAgentResponse(content) {
  let body = String(content || '').trim();
  let followups = [];

  const match = body.match(FOLLOWUPS_BLOCK_RE);
  if (match) {
    body = body.slice(0, match.index).trim();
    followups = tryParseFollowupsPayload(match[1]).slice(0, 3);
  }

  body = body.replace(/<<<FOLLOWUPS[\s\S]*?FOLLOWUPS>>>/gi, '').trim();

  if (!followups.length) {
    const alt = body.match(/\n---\s*(?:Уточн(?:ить|ения)|Продолжить)\s*---\s*\n((?:\d+\.\s+.+\n?)+)/i);
    if (alt) {
      body = body.slice(0, alt.index).trim();
      followups = (alt[1].match(/^\d+\.\s+(.+)$/gm) || [])
        .map((line) => line.replace(/^\d+\.\s+/, '').trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  }

  return { content: body, followups };
}

export { stripRedmineText } from './redmine-text.js';
