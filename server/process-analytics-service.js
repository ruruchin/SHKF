/**
 * Rule-based process analytics from Kanban tasks + local task knowledge.
 * Read-only — no Redmine writes.
 */

const STALE_DAYS = 7;

function daysSince(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return (now - t) / 86_400_000;
}

function totalLaborHours(task) {
  const entries = [
    ...(task.laborJournal || []),
    ...(task.laborTimeEntries || []),
  ];
  return entries.reduce((s, e) => s + (Number(e.hours) || 0), 0);
}

export class ProcessAnalyticsService {
  constructor(deps = {}) {
    this.taskKnowledge = deps.taskKnowledge || null;
    this.taskLinker = deps.taskLinker || null;
  }

  /**
   * @param {{ tasks?: object[], taskKnowledgeStore?: object, linkerSuggestions?: object[] }} input
   */
  analyze({ tasks = [], linkerSuggestions = [] } = {}) {
    const list = Array.isArray(tasks) ? tasks : [];
    const now = Date.now();
    const insights = [];

    const stale = list
      .filter((t) => daysSince(t.updatedOn, now) >= STALE_DAYS)
      .sort((a, b) => daysSince(b.updatedOn, now) - daysSince(a.updatedOn, now));

    if (stale.length) {
      insights.push({
        id: 'stale-tasks',
        severity: 'medium',
        title: `${stale.length} задач без движения ≥ ${STALE_DAYS} дн.`,
        detail: stale.slice(0, 5).map((t) => `#${t.id} · ${t.subject} (${Math.floor(daysSince(t.updatedOn, now))} дн.)`).join('\n'),
        action: 'Проверьте блокеры или уточните статус у заказчика (вручную в Redmine).',
      });
    }

    const overload = new Map();
    for (const t of list) {
      for (const a of t.assignees || []) {
        const key = a.name || a.id || 'unknown';
        overload.set(key, (overload.get(key) || 0) + 1);
      }
    }
    const heavy = [...overload.entries()].filter(([, n]) => n >= 8).sort((a, b) => b[1] - a[1]);
    if (heavy.length) {
      insights.push({
        id: 'assignee-overload',
        severity: 'high',
        title: 'Перегруз исполнителей',
        detail: heavy.map(([name, n]) => `${name}: ${n} открытых`).join('\n'),
        action: 'Перераспределите или отложите низкоприоритетные задачи.',
      });
    }

    const estimateGaps = list.filter((t) => {
      const est = Number(t.estimatedHours);
      const fact = totalLaborHours(t);
      return Number.isFinite(est) && est > 0 && fact > est * 1.35;
    });
    if (estimateGaps.length) {
      insights.push({
        id: 'estimate-vs-fact',
        severity: 'medium',
        title: `${estimateGaps.length} задач: факт >> оценка`,
        detail: estimateGaps.slice(0, 4).map((t) => {
          const fact = totalLaborHours(t).toFixed(1);
          return `#${t.id} · оценка ${t.estimatedHours}ч, списано ~${fact}ч`;
        }).join('\n'),
        action: 'Уточните оценку в планировании; Konstancia не меняет Redmine автоматически.',
      });
    }

    const tagCounts = new Map();
    const chunks = this.taskKnowledge?.store?.listChunks?.() || [];
    for (const c of chunks) {
      for (const tag of c.tags || []) {
        if (!tag || tag.length < 3) continue;
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    const repeated = [...tagCounts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (repeated.length) {
      insights.push({
        id: 'repeated-themes',
        severity: 'low',
        title: 'Повторяющиеся темы в выученных уроках',
        detail: repeated.map(([tag, n]) => `«${tag}» — ${n} раз`).join('\n'),
        action: 'Добавьте в шаблон ТЗ или чеклист — меньше уточнений по одному и тому же.',
      });
    }

    if (linkerSuggestions?.length) {
      insights.push({
        id: 'possible-duplicates',
        severity: 'medium',
        title: `${linkerSuggestions.length} возможных связей задач`,
        detail: linkerSuggestions.slice(0, 3).map((s) => `#${s.aId} ↔ #${s.bId}: ${s.reason || ''}`).join('\n'),
        action: 'Проверьте дубликаты в Konstancia («Найти связи») — связывание только по вашей кнопке.',
      });
    }

    const noDescription = list.filter((t) => !String(t.description || '').trim());
    if (noDescription.length >= 3) {
      insights.push({
        id: 'empty-descriptions',
        severity: 'medium',
        title: `${noDescription.length} задач без описания`,
        detail: noDescription.slice(0, 5).map((t) => `#${t.id} · ${t.subject}`).join('\n'),
        action: 'Запросите ТЗ у заказчика до старта работы.',
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      taskCount: list.length,
      insights: insights.slice(0, 12),
    };
  }

  formatInsightsMarkdown(report) {
    if (!report?.insights?.length) {
      return '**Инсайты процессов:** сейчас критичных узких мест не найдено по данным Kanban.';
    }
    const lines = ['**Инсайты процессов (только чтение, без изменений в Redmine):**'];
    for (const item of report.insights) {
      lines.push(`\n### ${item.title}`);
      if (item.detail) lines.push(item.detail);
      if (item.action) lines.push(`→ ${item.action}`);
    }
    return lines.join('\n');
  }
}
