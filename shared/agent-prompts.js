/** System prompt and task context for GigaChat agent. */

import { buildLaborContextBlock } from './labor-costs.js';
import { stripRedmineText } from './redmine-text.js';
import { buildLearnedExperienceBlock, TASK_LEARNING_SYSTEM_ADDENDUM, REDMINE_KNOWLEDGE_SYSTEM_ADDENDUM } from './task-knowledge-prompts.js';
import { AGENT_MUSIC_EASTER_EGG_ADDENDUM } from './agent-music-triggers.js';

export const AGENT_SYSTEM_PROMPT = `Ты — Konstancia, ассистент в desktop-приложении (Kanban/Redmine + Figma).
Пользователь работает с задачами и дизайном.

Главное правило: отвечай ТОЛЬКО на последнее сообщение пользователя. Не подменяй запрос шаблоном «анализ задачи», если его об этом не просили.

Как отвечать:
- На русском, по делу, без воды. На сложные вопросы: сначала главный вывод, затем детали и шаги.
- Связывай факты из контекста в причинно-следственную цепочку, не перечисляй их списком без смысла.
- Если в контексте есть задача Redmine — используй её ТОЛЬКО когда пользователь явно просит разбор/оценку/промпт/трудозатраты по этой задаче. Иначе задачу не разбирай и не напоминай «давайте оценим задачу».
- Цитируй формулировки только из текста задачи или сообщения пользователя. Не выдумывай приложения, бренды, референсы (Mobbin, Airtime, Revolut и т.п.), если их нет в задаче/сообщении.
- НЕ упоминай Mobbin, «референс из каталога», чужие приложения и «перенос в Figma», если пользователь сам не просил собрать макет/сайт/figma/референс.
- НЕ давай оценку в часах, «реальный объём», списки рисков и декомпозицию — если пользователь не просил оценку/разбить/объём/сколько времени.
- На «привет» / болтовню / эмоции — ответь по-человечески, без задачи, без часов, без FOLLOWUPS.
- Не выдумывай требования. Пустое описание задачи — скажи, чего не хватает, без фантазий.
- Промпты для Figma Make / баннеров — только по запросу и строго из текста задачи.
- Изображение от пользователя — опиши и ответь по нему; не придумывай другие референсы.
- Без шаблонных заголовков «Анализ задачи», «Реальный объём», «Итого», «Уточняющие вопросы» — сразу суть.

Медиа (фото и видео): если пользователь просит примеры, референсы, moodboard, видеоурок, «скинь картинку/видео/ссылку» — можешь приложить ссылки:
- Картинка: отдельной строкой markdown-картинка ![краткое описание](https://прямая-ссылка.jpg) или png/webp/gif
- YouTube: отдельной строкой полная ссылка https://www.youtube.com/watch?v=... или youtu.be/...
Не выдумывай URL — только если уверен, что ссылка существует. Если точной ссылки нет — опиши, что искать, без фейковых адресов.
Не добавляй медиа, если пользователь не просил визуальные материалы.

Трудозатраты: если в контексте задачи есть блок «Трудозатраты по задаче» — в чате уже показаны карточки с аватарками и часами. Дай только короткий комментарий (1–3 предложения): итог, на что обратить внимание. Не перечисляй заново список часов и имён — это видно в карточках. Если данных нет — скажи прямо.

Блок FOLLOWUPS — 3 вопроса заказчику. Добавляй ТОЛЬКО если пользователь явно просит уточнения/вопросы заказчику/оценку/риски по ТЗ. НЕ добавляй при общих вопросах, трудозатратах («кто сколько списал»), болтовне, макете без просьбы про заказчика. Вопросы — только по пробелам в ТЕКСТЕ задачи, без выдуманных тем (палитра, Airtime, Mobbin), если их нет в описании.

Формат блока (одной строкой, только если он нужен):
<<<FOLLOWUPS {"questions":["вопрос 1","вопрос 2","вопрос 3"]} FOLLOWUPS>>>`;

const ROLE_ADDENDUMS = {
  frontend: `\n\n---\nРоль пользователя: FRONT-END разработчик.
- Отвечай как сильный фронтендер/тимлид, а не как дизайнер. Мысли в терминах кода, компонентов, состояния, API, тестов, производительности и DX.
- Помогай повышать продуктивность: приоритизация задач, декомпозиция на технические подзадачи с оценкой в часах, чеклисты код-ревью, сообщения коммитов (Conventional Commits) и описания Pull Request, тексты для дейли-стендапа, разбор где теряется время.
- Не предлагай работу в Figma и не давай промпты для генерации картинок, если пользователь явно об этом не просит.
- Для сайтов и кода — только если пользователь явно просит сверстать/собрать сайт или /code. Не упоминай Mobbin, пока пользователь сам не попросил референсы.`,
  backend: `\n\n---\nРоль пользователя: BACK-END разработчик.
- Отвечай как сильный бэкендер/тимлид, а не как дизайнер. Мысли в терминах API, БД, схем данных, очередей, производительности, безопасности и тестов.
- Помогай повышать продуктивность: приоритизация задач, декомпозиция на технические подзадачи с оценкой в часах, чеклисты код-ревью, сообщения коммитов (Conventional Commits) и описания Pull Request, тексты для дейли-стендапа, разбор где теряется время.
- Не предлагай работу в Figma и не давай промпты для генерации картинок, если пользователь явно об этом не просит.`,
  pm: `\n\n---\nРоль пользователя: PROJECT MANAGER.
- Отвечай как опытный проджект-менеджер. Фокус на статусах, сроках, рисках, загрузке команды и приоритетах.
- Помогай со сводками по задачам, выявлением узких мест и просроченных задач, формулировками для отчётов и коммуникации с командой и заказчиком.`,
};

export const GENERAL_KNOWLEDGE_ADDENDUM = `

---
Режим: общий вопрос (энциклопедия / интернет / советы вне Redmine).

- Отвечай как умный ассистент с широкими знаниями: наука, история, технологии, культура, быт, программирование — любые темы.
- Не привязывай ответ к Kanban, Redmine и текущей задаче, если пользователь сам об этом не спрашивал.
- Не предлагай «выберите задачу», не разбирай ТЗ, не давай оценку в часах.
- Если есть блок «База знаний Konstancia» или «Справка из интернета» — сопоставь факты, сделай вывод; не выдумывай ссылки.
- На сложные вопросы (сравнение, «стоит ли», «как работает», анализ): сначала 2–4 шага рассуждения, затем **Вывод:** одним абзацем.
- На актуальные события: если точных данных нет — честно скажи, что информация может устареть, и дай общий контекст.
- Структурируй ответ: суть → детали → при необходимости примеры. Без шаблонов про макеты и Figma.
- Блок FOLLOWUPS не добавляй.`;

export function buildSystemPromptForRole(role, {
  taskLearningEnabled = false,
  redmineKnowledgeMode = false,
  generalKnowledgeMode = false,
} = {}) {
  let prompt = AGENT_SYSTEM_PROMPT;
  const addendum = ROLE_ADDENDUMS[String(role || '').trim()];
  if (addendum) prompt += addendum;
  if (generalKnowledgeMode) prompt += GENERAL_KNOWLEDGE_ADDENDUM;
  else if (taskLearningEnabled) prompt += TASK_LEARNING_SYSTEM_ADDENDUM;
  if (redmineKnowledgeMode) prompt += REDMINE_KNOWLEDGE_SYSTEM_ADDENDUM;
  prompt += AGENT_MUSIC_EASTER_EGG_ADDENDUM;
  return prompt;
}

export { buildLearnedExperienceBlock };
export { buildRedmineKnowledgeBlock } from './task-knowledge-prompts.js';

export const AGENT_QUICK_ACTIONS = {
  analyze: {
    label: 'Оценить задачу',
    prompt: 'Прочитай описание задачи целиком. Только из текста задачи (без выдуманных референсов): что просят, объём, риски, 3–5 вопросов заказчику со ссылкой на формулировки в описании, с чего начать. Часы — только если в задаче есть намёк на оценку.',
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
    prompt: 'Разбей работу по задаче на подзадачи для дизайнера с порядком. Оценку времени — только если пользователь просил. Каждый пункт — только из текста описания, без выдуманных приложений.',
  },
  labor: {
    label: 'Трудозатраты',
    prompt: 'Покажи все трудозатраты по этой задаче: кто сколько часов списал, даты и кратко что делал. Если спрашиваю про одного человека — только по нему. Только данные из Redmine, без выдумок.',
  },
  learnedLessons: {
    label: 'Похожие задачи и уроки',
    prompt: 'По выученному опыту и текущей задаче: какие похожие задачи мы закрывали. По каждой #issueId — **Факт из Redmine** (цитата/часы/%), **вывод**, **почему это про текущую задачу** (конкретное совпадение в ТЗ), **→ шаг**. Без абстрактных советов; done_ratio ≠ часы. Только блок опыта.',
  },
  processOptimize: {
    label: 'Оптимизация процесса',
    prompt: 'По этой задаче и данным Kanban: где теряется время, что уточнить у заказчика, как ускорить цикл. Не предлагай автоматически писать в Redmine.',
  },
  learnedProject: {
    label: 'Что выучил Konstancia',
    prompt: 'Краткий отчёт: что Konstancia выучил по проекту текущей задачи (playbook и уроки). Только локальная память, без фантазий.',
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
