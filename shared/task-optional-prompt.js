/** Мягкий вопрос «это по задачке?» вместо жёсткого требования выбрать задачу. */

import { isGeneralKnowledgeQuery } from './general-knowledge-intent.js';
import { isGeneralAdvisoryQuery, requiresCurrentTask } from './task-learning-intent.js';
import { searchKanbanTasksForKnowledge } from './task-knowledge-prompts.js';

const TASK_WORK_RE = /оцен|разбить|трудозатрат|уч[её]т\s+времени|сколько\s+час|списал|баннер|лендинг|figma\s*make|промпт|mobbin|моббин|\/site|\/figma|сверст|верст\w*\s+сайт|задач|redmine|kanban|уточн|заказчик|риск|стендап|коммит|pull\s*request|код.?ревью|план\s+на\s+день|напиши\s+(?:мне\s+)?код|сделай\s+код|сверстай|сверсти/i;

export const TASK_OPTIONAL_DECLINE = 'Не-а';

export function isTaskWorkRequest(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (isGeneralAdvisoryQuery(t)) return false;
  if (isGeneralKnowledgeQuery(t)) return false;
  return TASK_WORK_RE.test(t);
}

export function requiresTaskSelection(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (isGeneralKnowledgeQuery(t)) return false;
  if (isGeneralAdvisoryQuery(t)) return false;
  if (/найди\s+файл|найти\s+файл|где\s+лежит|проиндексир/i.test(t)) return false;
  if (requiresCurrentTask(t)) return true;
  return isTaskWorkRequest(t);
}

export function isTaskOptionalDecline(text) {
  return /^не-а$/i.test(String(text || '').trim());
}

export function parseTaskOptionalPick(text) {
  const m = String(text || '').trim().match(/^да\s*[—-]\s*задача\s*#(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function formatTaskOptionalFollowup(task) {
  const id = Number(task?.id || task?.issueId);
  if (!id) return '';
  const subject = String(task?.subject || '').trim().slice(0, 52);
  return `Да — задача #${id}${subject ? `: ${subject}` : ''}`;
}

export function buildTaskOptionalPrompt(query, kanbanTasks = [], { limit = 5 } = {}) {
  const hits = searchKanbanTasksForKnowledge(query, kanbanTasks, { limit });
  const lines = [
    'Стой-стой-стой, это вопрос **по задачке**?',
    '',
  ];

  if (hits.length) {
    lines.push('Может, ты имел в виду одну из этих:');
    for (const hit of hits.slice(0, limit)) {
      const subject = String(hit.subject || 'без темы').trim();
      lines.push(`- **#${hit.issueId}** · ${subject}`);
    }
  } else {
    lines.push('Похожих задач в Kanban не нашла.');
  }

  lines.push('', 'Или нет?');

  const followups = hits
    .slice(0, 2)
    .map((hit) => formatTaskOptionalFollowup({ id: hit.issueId, subject: hit.subject }))
    .filter(Boolean);
  followups.push(TASK_OPTIONAL_DECLINE);

  return {
    content: lines.join('\n'),
    followups,
    suggestedTasks: hits,
    taskOptionalPrompt: true,
  };
}
