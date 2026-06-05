import { stripRedmineText } from './redmine-text.js';

function normalizePersonName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function parseHoursValue(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

/** Journal comments that contain «Трудозатраты» (Easy Redmine / similar plugins). */
export function parseLaborFromJournals(journals = []) {
  const items = [];
  for (const journal of journals) {
    const raw = String(journal?.notes || '').trim();
    if (!raw || !/трудозатрат/i.test(raw)) continue;

    const notes = stripRedmineText(raw);
    const who = journal.user?.name || 'Участник';
    const when = journal.created_on || '';

    const hoursMatch = notes.match(/Трудозатраты:\s*([\d.,]+)\s*(?:ч|час)/i)
      || notes.match(/([\d.,]+)\s*(?:ч|час)(?:\s|$)/i);
    const hours = hoursMatch ? parseHoursValue(hoursMatch[1]) : null;

    let description = notes;
    const descMatch = notes.match(/Описание участия:\s*([\s\S]*)/i);
    if (descMatch) description = descMatch[1].trim();
    else {
      description = notes
        .replace(/^[\s\S]*?Трудозатраты:\s*[\d.,]+\s*(?:ч|час)\s*/i, '')
        .trim();
    }

    items.push({
      source: 'journal',
      journalId: journal.id,
      userId: journal.user?.id || null,
      user: who,
      date: when,
      hours,
      description: description || notes,
      raw: notes,
    });
  }
  return items;
}

export function mapTimeEntries(entries = []) {
  return entries.map((entry) => ({
    source: 'time_entry',
    id: entry.id,
    userId: entry.user?.id || null,
    user: entry.user?.name || 'Участник',
    hours: parseHoursValue(entry.hours),
    spentOn: entry.spent_on || '',
    date: entry.spent_on || entry.created_on || '',
    activity: entry.activity?.name || '',
    comments: stripRedmineText(entry.comments || ''),
    description: stripRedmineText(entry.comments || ''),
  }));
}

export function summarizeLaborByPerson(items = []) {
  const totals = new Map();
  for (const item of items) {
    const key = normalizePersonName(item.user);
    if (!key) continue;
    const prev = totals.get(key) || { user: item.user, hours: 0, entries: 0 };
    prev.entries += 1;
    if (item.hours != null) prev.hours += item.hours;
    totals.set(key, prev);
  }
  return [...totals.values()].sort((a, b) => b.hours - a.hours);
}

function formatHours(hours) {
  if (hours == null) return '—';
  const rounded = Math.round(hours * 100) / 100;
  return String(rounded).replace('.', ',');
}

function formatLaborEntry(item, index) {
  const lines = [];
  const head = item.hours != null
    ? `**${item.user}** — ${formatHours(item.hours)} ч`
    : `**${item.user}**`;
  const meta = [item.date, item.spentOn, item.activity].filter(Boolean).join(' · ');
  lines.push(`${index}. ${head}${meta ? ` (${meta})` : ''}`);
  if (item.comments) lines.push(`   Комментарий: ${item.comments}`);
  if (item.description && item.description !== item.comments) {
    const desc = item.description.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of desc.slice(0, 8)) {
      lines.push(`   - ${line.replace(/^[-•]\s*/, '')}`);
    }
  }
  return lines.join('\n');
}

/** Markdown block for GigaChat context. */
export function buildLaborContextBlock(task) {
  const journalItems = task?.laborJournal || [];
  const timeItems = task?.laborTimeEntries || [];
  const all = [...timeItems, ...journalItems];
  if (!all.length) return '';

  const parts = [
    '## Трудозатраты по задаче (данные Redmine)',
    '',
    '_Используй только эти строки для ответов про часы и участие людей. Не пиши, что данных нет, если они перечислены ниже._',
    '',
  ];

  if (timeItems.length) {
    parts.push('### Учёт времени (time entries API)', '');
    timeItems.forEach((item, i) => {
      parts.push(formatLaborEntry(item, i + 1));
    });
    parts.push('');
  }

  if (journalItems.length) {
    parts.push('### Записи в журнале задачи (комментарии с «Трудозатраты»)', '');
    journalItems.forEach((item, i) => {
      parts.push(formatLaborEntry(item, i + 1));
    });
    parts.push('');
  }

  const totals = summarizeLaborByPerson(all.filter((x) => x.hours != null));
  if (totals.length) {
    parts.push('### Сумма по людям (из доступных записей)', '');
    totals.forEach((row) => {
      parts.push(`- **${row.user}:** ${formatHours(row.hours)} ч (${row.entries} зап.)`);
    });
    parts.push('');
  }

  if (task?.estimatedHours != null) {
    parts.push(`**Оценка задачи (estimated_hours):** ${formatHours(parseHoursValue(task.estimatedHours))} ч`, '');
  }

  return parts.join('\n').trim();
}

export function isLaborCostQuery(text) {
  return /трудозатрат|уч[её]т\s+времени|time\s*entr|залог\s+времен|сколько\s+час|человеко.?час|списал|списали|отработал|затратил|залогировал/i.test(String(text || ''));
}

function pluralRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** «7 месяца назад» — как в Redmine. */
export function formatRelativeTimeRu(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return String(isoDate);

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - d.getTime()) / 1000));
  if (diffSec < 60) return 'только что';

  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) {
    return `${minutes} ${pluralRu(minutes, 'минуту', 'минуты', 'минут')} назад`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${pluralRu(hours, 'час', 'часа', 'часов')} назад`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} ${pluralRu(days, 'день', 'дня', 'дней')} назад`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} ${pluralRu(months, 'месяц', 'месяца', 'месяцев')} назад`;
  }

  const years = Math.floor(months / 12);
  return `${years} ${pluralRu(years, 'год', 'года', 'лет')} назад`;
}

export function getLaborDisplayEntries(task) {
  const journal = (task?.laborJournal || []).map((item) => ({
    ...item,
    kind: 'journal',
    sortDate: item.date || '',
  }));
  const time = (task?.laborTimeEntries || []).map((item) => ({
    ...item,
    kind: 'time_entry',
    sortDate: item.date || item.spentOn || '',
  }));

  const merged = [...journal, ...time];
  merged.sort((a, b) => {
    const ta = new Date(a.sortDate).getTime() || 0;
    const tb = new Date(b.sortDate).getTime() || 0;
    return tb - ta;
  });
  return merged;
}

/** Если в вопросе есть имя — оставить только его записи. */
export function filterLaborEntriesByQuery(entries, query) {
  if (!entries?.length) return [];
  const q = normalizePersonName(query);
  if (!q) return entries;

  const matched = entries.filter((entry) => {
    const name = normalizePersonName(entry.user);
    if (!name) return false;
    if (q.includes(name)) return true;
    const parts = name.split(' ').filter((p) => p.length > 2);
    return parts.some((part) => q.includes(part));
  });

  return matched.length ? matched : entries;
}

export function formatHoursDisplay(hours) {
  if (hours == null) return '—';
  const rounded = Math.round(hours * 100) / 100;
  return String(rounded).replace('.', ',');
}

/** Однострочная сводка трудозатрат для контекста агента (прошлые задачи). */
export function buildLaborSummaryCompact(task) {
  if (!task?.id) return '';
  const entries = getLaborDisplayEntries(task);
  const withHours = entries.filter((e) => e.hours != null);
  const total = withHours.reduce((sum, e) => sum + e.hours, 0);
  const est = parseHoursValue(task.estimatedHours);
  if (!withHours.length && est == null) return '';

  const parts = [];
  if (total > 0) {
    const byPerson = summarizeLaborByPerson(withHours);
    parts.push(`факт **${formatHours(total)} ч**`);
    if (byPerson.length === 1) {
      parts.push(`(${byPerson[0].user})`);
    } else if (byPerson.length > 1) {
      parts.push(`(${byPerson.map((p) => `${p.user}: ${formatHours(p.hours)} ч`).join(', ')})`);
    }
  } else {
    parts.push('факт: часы не зафиксированы');
  }

  if (est != null) {
    parts.push(`оценка **${formatHours(est)} ч**`);
    if (total > 0 && est > 0) {
      const ratio = total / est;
      if (ratio > 1.25) parts.push('→ недооценка');
      else if (ratio < 0.75) parts.push('→ переоценка');
      else parts.push('→ в оценку');
    }
  }

  return parts.join(' · ');
}

/** Текст комментария для журнала Redmine (плагин трудозатрат). */
export function formatLaborLogNotes(hours, description) {
  const h = formatHoursDisplay(Number(hours));
  const lines = String(description || '')
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let notes = `Трудозатраты: ${h} ч`;
  if (lines.length) {
    const bullets = lines.map((line) => (line.startsWith('•') ? line : `• ${line}`));
    notes += `\n\nОписание участия:\n${bullets.join('\n')}`;
  }
  return notes;
}

export { normalizePersonName };
