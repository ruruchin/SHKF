/** Rule-based morning brief from Kanban task list (no LLM). */

const STALE_DAYS = 7;
const RECENT_DAYS = 2;

function daysSince(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (!Number.isNaN(t)) return (now - t) / 86_400_000;
  return 999;
}

function formatBriefDate() {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString('ru-RU');
  }
}

function taskReason(task, { isUpdated, isStale, isRecent }) {
  if (isUpdated) return 'обновилась с прошлой синхронизации';
  if (isStale) return `давно без движения (${Math.floor(daysSince(task.updatedOn))} дн.)`;
  if (isRecent) return 'недавняя активность';
  if (/сроч|urgent|высок|high/i.test(`${task.priority || ''} ${task.subject || ''}`)) {
    return 'высокий приоритет';
  }
  return 'в очереди';
}

function scoreTask(task, updateIds, now) {
  let score = 0;
  const days = daysSince(task.updatedOn, now);
  if (updateIds.has(task.id)) score += 120;
  if (days <= 1) score += 55;
  else if (days <= RECENT_DAYS) score += 30;
  if (days >= STALE_DAYS) score += 45;
  if (/сроч|urgent|высок|high/i.test(task.priority || '')) score += 35;
  if (/баг|bug|крит|block/i.test(task.subject || '')) score += 25;
  return score;
}

/**
 * @param {{ tasks?: object[], updates?: object[], userName?: string }} input
 */
export function buildMorningBrief({ tasks = [], updates = [], userName = '' } = {}) {
  const now = Date.now();
  const list = Array.isArray(tasks) ? tasks : [];
  const updateIds = new Set((updates || []).map((t) => t.id));

  const updatedTasks = list.filter((t) => updateIds.has(t.id));
  const staleTasks = list
    .filter((t) => daysSince(t.updatedOn, now) >= STALE_DAYS)
    .sort((a, b) => daysSince(b.updatedOn, now) - daysSince(a.updatedOn, now));
  const recentTasks = list
    .filter((t) => daysSince(t.updatedOn, now) <= RECENT_DAYS)
    .sort((a, b) => new Date(b.updatedOn).getTime() - new Date(a.updatedOn).getTime());

  const topStart = list
    .map((task) => {
      const isUpdated = updateIds.has(task.id);
      const isStale = daysSince(task.updatedOn, now) >= STALE_DAYS;
      const isRecent = daysSince(task.updatedOn, now) <= RECENT_DAYS;
      return {
        task,
        score: scoreTask(task, updateIds, now),
        reason: taskReason(task, { isUpdated, isStale, isRecent }),
      };
    })
    .sort((a, b) => b.score - a.score);

  const greetingName = userName?.trim() || 'дизайнер';

  return {
    dateLabel: formatBriefDate(),
    greeting: `Доброе утро, ${greetingName}`,
    total: list.length,
    updatedTasks,
    staleTasks,
    recentTasks,
    topStart,
    empty: list.length === 0,
  };
}
