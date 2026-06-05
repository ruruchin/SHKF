/** Prompts for distilling Redmine issues into local knowledge chunks. */

import { buildLaborSummaryCompact } from './labor-costs.js';
import { extractKnowledgeTokens, extractSearchPhrases, extractRequestedCount } from './task-learning-intent.js';

export const TASK_DISTILL_SYSTEM = `Ты — аналитик процессов и senior-дизайнер. Извлекаешь глубокие уроки из задачи Redmine для базы знаний команды.

Правила:
- Только факты из текста задачи, комментариев и трудозатрат. Ничего не выдумывай.
- 4–8 lessons: разные типы (summary, requirements, resolution, blockers, labor_pattern, qa_gaps).
- В text — конкретика с доказательством: что просили (цитата), что изменилось после комментария X, где застряли (блокер), сколько часов и на что (если есть), какой % готовности был при проблеме.
- Каждый lesson должен содержать «потому что»: не совет, а вывод из факта.
- processPatterns — повторяемые паттерны работы (1–4 фразы).
- estimateAccuracy — "underestimated" | "ok" | "overestimated" | "unknown" по сравнению estimate и факта, если данные есть.
- Не предлагай действий в Redmine.
- Ответ — ТОЛЬКО валидный JSON без markdown:
{"lessons":[{"type":"summary|requirements|resolution|blockers|labor_pattern|qa_gaps","text":"...","tags":["..."]}],"risks":["..."],"reusableTips":["..."],"processPatterns":["..."],"estimateAccuracy":"unknown","deliverable":"banner|app|landing|other|unknown"}`;

export const TASK_RETRIEVAL_SYNTHESIS_SYSTEM = `Ты Konstancia. Синтезируй релевантный опыт из прошлых задач для ТЕКУЩЕГО запроса.

Формат (без нумерованных списков 1. 2. 3.):
- Главный вывод — 2–3 предложения: что общего между прошлыми задачами и текущей, с #issueId.
- По КАЖДОЙ релевантной задаче — ### #issueId · название, затем строго:
  - **Факт из Redmine:** цитата или формулировка из блока (ТЗ, комментарий, часы, % готовности). Не путай done_ratio (%) с трудозатратами (ч).
  - **Что пошло не так / что сработало:** только из текста урока в памяти, своими словами.
  - **Почему это про текущую задачу:** одна конкретная параллель — какая строка ТЗ/тема/риск текущей задачи совпадает; без общих фраз вроде «важно учитывать задержки».
  - **→ Сделать сейчас:** 1 actionable шаг.
- В конце — 2–3 маркера «-» с приоритетами на текущую задачу.

Запрещено:
- Абстрактные советы без привязки к факту из блока («уточняйте требования», «внешние факторы» — только если в комментарии/описании назван конкретный фактор).
- Выдуманные часы, проценты, люди, комментарии.
- Метки [labor_pattern]/[tip] в ответе пользователю.`;

export function buildTaskDistillUserMessage(issue) {
  const labor = [
    ...(issue.laborJournal || []).map((e) => `${e.userName || '—'}: ${e.hours}ч — ${e.description || ''}`),
    ...(issue.laborTimeEntries || []).map((e) => `${e.userName || '—'}: ${e.hours}ч (${e.spentOn || ''})`),
  ].slice(0, 12);

  return [
    `#${issue.id} · ${issue.subject || '—'}`,
    `Проект: ${issue.project || '—'} · Трекер: ${issue.tracker || '—'} · Статус: ${issue.status || '—'}`,
    issue.description ? `\n## Описание\n${String(issue.description).slice(0, 6000)}` : '\n## Описание\n(пусто)',
    issue.comments ? `\n## Комментарии (последние)\n${String(issue.comments).slice(0, 4000)}` : '',
    labor.length ? `\n## Трудозатраты\n${labor.join('\n')}` : '',
    issue.estimatedHours != null ? `\nОценка: ${issue.estimatedHours}ч` : '',
    issue.doneRatio != null ? `Готовность: ${issue.doneRatio}%` : '',
  ].filter(Boolean).join('\n');
}

export const TASK_LEARNING_SYSTEM_ADDENDUM = `
---
Режим операционного интеллекта (если есть блок опыта ниже):
- Отвечай как тимлид на разборе: цепочка **факт → причина → следствие → что делать по текущей задаче**.
- Каждый вывод обязан опираться на строку из блока (описание, комментарий, часы, % готовности). Если факта нет — «в данных Redmine этого нет», не додумывай.
- **done_ratio (готовность %)** и **трудозатраты (ч)** — разные поля; не называй процент готовности «часами» или «трудозатратами».
- По КАЖДОМУ #issueId: ### #issueId · название, затем блоки **Факт из Redmine**, **Вывод**, **Почему это про текущую задачу** (назови конкретное совпадение в теме/ТЗ текущей задачи), **→ Шаг**.
- Запрещены общие фразы без доказательства: «важно уточнять требования», «могут быть задержки», «нужен пересмотр оценки» — только если в блоке есть конкретика (что уточняли, кто писал, какие часы, какой комментарий).
- Сопоставляй несколько #issueId между собой: «тот же паттерн: …» только если паттерн виден в фактах обеих задач.
- Если опыт не подходит к текущему ТЗ — скажи прямо и почему.
- НЕ используй нумерованные списки (1. 2. 3.) — только ### и маркеры «-».
- Не выдумывай уроки, проекты и цифры, которых нет в блоке.`;

export const REDMINE_KNOWLEDGE_SYSTEM_ADDENDUM = `
---
Режим базы знаний Redmine (блок «Каталог Redmine» ниже — единственный источник):
- Пользователь ищет задачи, файлы, вложения по теме (включая закрытые). Ты УЖЕ получил результаты поиска — используй их.
- ЗАПРЕЩЕНО просить пользователя вручную искать в Redmine, указывать проект/дату/статус «для начала поиска», или говорить что поиск «невозможен».
- Если пользователь просит конкретное число («5 штук», «3 ссылки», «топ 7») — выдай **ровно столько** лучших кандидатов из блока, не больше.
- Иначе дай 3–8 **вариантов-кандидатов** из блока, даже если уверенность средняя — «возможно», «похоже по теме/названию».
- По КАЖДОМУ кандидату — маркеры для UI (обязательно):
  <<<TASKCARD issueId|краткая причина совпадения>>>
  Если в блоке есть вложение — сразу под карточкой:
  <<<TASKFILE issueId|attachmentId|filename>>>
- attachmentId и filename — только из блока.
- Если в блоке «Совпадения по Kanban» — это тоже валидные кандидаты (ещё не все задачи могли попасть в полный индекс).
- Если совпадений нет — скажи честно и предложи другое ключевое слово; не отправляй в интерфейс Redmine.
- НЕ используй нумерованные списки 1. 2. 3. — только «-» и TASKCARD/TASKFILE.`;

export function searchKanbanTasksForKnowledge(query, tasks = [], { limit = 10 } = {}) {
  const tokens = extractKnowledgeTokens(query);
  if (!tokens.length) return [];

  const scored = [];
  for (const task of tasks || []) {
    if (!task?.id) continue;
    const hay = [
      task.subject,
      task.description,
      task.project,
      task.status,
      task.tracker,
    ].filter(Boolean).join(' ').toLowerCase();
    if (!hay.trim()) continue;

    let score = 0;
    for (const tok of tokens) {
      if (hay.includes(tok)) score += tok.length >= 6 ? 3 : 2;
      else if (tok.length >= 5 && hay.split(/\s+/).some((w) => w.startsWith(tok.slice(0, 5)))) score += 1;
    }
    if (score <= 0) continue;
    scored.push({
      score,
      issueId: task.id,
      subject: task.subject || '',
      project: task.project || '',
      status: task.status || '',
      url: task.url || '',
      snippet: clipEvidence(`${task.subject || ''}. ${String(task.description || '').slice(0, 200)}`, 180),
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(15, Number(limit) || 10)));
}

function buildSearchLabel(query = '') {
  const phrases = extractSearchPhrases(query);
  const topic = phrases.find((p) => p.length >= 8) || phrases[0];
  if (topic) return topic.slice(0, 120);

  return String(query || '')
    .replace(/мне\s+нужно\s+чтобы\s+ты\s+/i, '')
    .replace(/найди[^\n]*?redmine[^\n]*?/i, '')
    .replace(/найди|найти|ищи|покажи|дай|предложи/gi, '')
    .replace(/\d+\s*(?:штук|штуки|шт\.?|ссылок|вариант(?:ов|а|ы)?|кандидат(?:ов|а|ы)?|мест(?:а|о)?)/gi, '')
    .replace(/где\s+они\s+могут\s+быть/gi, '')
    .replace(/возможные\s+ссылки/gi, '')
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'ваш запрос';
}

function mergeSearchCandidates({
  kanbanHits = [],
  metaHits = [],
  attachmentHits = [],
  apiHits = [],
  chunks = [],
  issueDetails = null,
  limit = 8,
} = {}) {
  const map = new Map();
  const details = issueDetails instanceof Map ? issueDetails : new Map();

  const add = (issueId, patch) => {
    const id = Number(issueId);
    if (!id) return;
    const prev = map.get(id) || {
      issueId: id,
      score: 0,
      reasons: [],
      attachments: [],
      subject: '',
      project: '',
      status: '',
    };
    prev.score += Number(patch.score || 1);
    if (patch.reason) prev.reasons.push(patch.reason);
    if (patch.subject) prev.subject = patch.subject;
    if (patch.project) prev.project = patch.project;
    if (patch.status) prev.status = patch.status;
    if (patch.attachment) {
      const key = `${patch.attachment.id}:${patch.attachment.filename}`;
      if (!prev.attachments.some((a) => `${a.id}:${a.filename}` === key)) {
        prev.attachments.push(patch.attachment);
      }
    }
    map.set(id, prev);
  };

  for (const hit of apiHits || []) {
    add(hit.issueId, {
      score: hit.score || 15,
      subject: hit.subject,
      project: hit.project,
      status: hit.status,
      reason: hit.attachmentId
        ? `файл «${hit.filename || hit.attachmentHint || hit.subject}» (Redmine search)`
        : 'совпадение в Redmine search (включая закрытые)',
      attachment: hit.attachmentId
        ? { id: hit.attachmentId, filename: hit.filename || hit.attachmentHint || hit.subject }
        : undefined,
    });
  }
  for (const hit of attachmentHits || []) {
    add(hit.issueId, {
      score: (hit.score || 1) + 25,
      subject: hit.subject,
      project: hit.project,
      status: hit.status,
      reason: `файл «${hit.filename}»`,
      attachment: { id: hit.attachmentId, filename: hit.filename },
    });
  }
  for (const hit of kanbanHits || []) {
    add(hit.issueId, {
      score: hit.score || 5,
      subject: hit.subject,
      project: hit.project,
      status: hit.status,
      reason: hit.snippet ? `Kanban: ${hit.snippet}` : 'совпадение в Kanban',
    });
  }
  for (const hit of metaHits || []) {
    add(hit.issueId, {
      score: hit.score || 4,
      subject: hit.subject,
      project: hit.project,
      status: hit.status,
      reason: 'локальный каталог',
    });
    for (const a of hit.attachments || []) {
      if (a?.id && a?.filename) {
        add(hit.issueId, {
          score: 2,
          attachment: { id: a.id, filename: a.filename },
        });
      }
    }
  }
  for (const c of chunks || []) {
    if (c.type === 'attachment' && c.attachmentId && c.filename) {
      add(c.issueId, {
        score: 20,
        reason: `файл «${c.filename}»`,
        attachment: { id: c.attachmentId, filename: c.filename },
      });
    } else if (c.issueId) {
      add(c.issueId, { score: 2, reason: 'фрагмент из памяти' });
    }
  }

  for (const [id, row] of map) {
    const issue = details.get(id);
    if (!issue) continue;
    if (!row.subject) row.subject = issue.subject || '';
    if (!row.project) row.project = issue.project || '';
    if (!row.status) row.status = issue.status || '';
    for (const a of issue.attachments || []) {
      if (a?.id && a?.filename) {
        add(id, { score: 0.5, attachment: { id: a.id, filename: a.filename } });
      }
    }
  }

  const cap = Math.max(1, Math.min(15, Number(limit) || 8));
  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);
}

export function formatRedmineSearchReply({
  query = '',
  kanbanHits = [],
  metaHits = [],
  attachmentHits = [],
  apiHits = [],
  chunks = [],
  issueDetails = null,
  stats = null,
  indexingStatus = null,
  kanbanCount = 0,
  limit = null,
} = {}) {
  const requestedLimit = Math.max(1, Math.min(15, Number(limit) || extractRequestedCount(query)));
  const candidates = mergeSearchCandidates({
    kanbanHits,
    metaHits,
    attachmentHits,
    apiHits,
    chunks,
    issueDetails,
    limit: requestedLimit,
  });

  const label = buildSearchLabel(query);

  const lines = [];

  if (indexingStatus?.indexed > 0) {
    lines.push(`_Проиндексировал ${indexingStatus.indexed} задач для поиска._`, '');
  }

  if (!candidates.length) {
    lines.push(
      `По запросу «${label}» в Redmine и локальном каталоге совпадений нет.`,
      '',
      `- Проиндексировано: ${stats?.issuesIndexed || 0} задач, ${stats?.attachmentsIndexed || 0} вложений`,
      `- Kanban (активные): ${kanbanCount || '—'} задач`,
      '',
      'Попробуйте короче: **черноморец** или **листовка черноморец**. Или: **проиндексируй задачи сам**.',
    );
    return lines.join('\n');
  }

  const countLine = candidates.length < requestedLimit
    ? `Нашёл **${candidates.length}** из запрошенных **${requestedLimit}** кандидатов по «${label}» (Redmine search + каталог).`
    : `Нашёл **${candidates.length}** кандидатов по «${label}» (Redmine search + каталог).`;
  lines.push(
    countLine,
    'Ниже — реальные #задачи, не выдуманные:',
    '',
  );

  for (const c of candidates) {
    const reason = [...new Set(c.reasons.filter(Boolean))].slice(0, 2).join('; ') || 'похоже по теме';
    const meta = [c.project, c.status].filter(Boolean).join(' · ');
    lines.push(`- **#${c.issueId}** · ${c.subject || 'Задача'}${meta ? ` · ${meta}` : ''} — ${reason}`);
    lines.push(`<<<TASKCARD ${c.issueId}|${reason.slice(0, 100)}>>>`);
  for (const att of (c.attachments || []).slice(0, 8)) {
      lines.push(`<<<TASKFILE ${c.issueId}|${att.id}|${att.filename}>>>`);
    }
  }

  lines.push('', '_Нажмите на задачу или файл. Если не то — уточните запрос._');
  return lines.join('\n');
}

export function buildRedmineKnowledgeBlock({
  chunks = [],
  attachmentHits = [],
  kanbanHits = [],
  issueDetails = null,
  stats = null,
  indexingStatus = null,
} = {}) {
  const hasHits = chunks?.length || attachmentHits?.length || kanbanHits?.length;
  const indexed = stats?.issuesIndexed || 0;

  const lines = [
    '## Каталог Redmine (задачи и вложения — только факты ниже)',
    '',
    '_Konstancia: выдай кандидатов TASKCARD (+ TASKFILE если есть id файла). Не отправляй пользователя искать в Redmine вручную._',
  ];

  if (indexingStatus?.started) {
    lines.push(
      `_Индексация: ${indexingStatus.indexed || 0} новых из ${indexingStatus.total || '—'}`
      + (indexingStatus.pending ? `, ещё ${indexingStatus.pending} в очереди._` : '._'),
    );
  } else if (stats?.issuesIndexed) {
    lines.push(`_Проиндексировано задач: ${stats.issuesIndexed}, фрагментов: ${stats.chunks || '—'}, вложений: ${stats.attachmentsIndexed || '—'}._`);
  } else if (!hasHits) {
    lines.push('_Локальный каталог пуст или ещё не построен — ниже только быстрый поиск по Kanban._');
  }

  if (!hasHits && !indexingStatus?.started) {
    lines.push('', '_Совпадений не найдено. Сообщи пользователю и предложи другое слово (название клиента, тип материала)._');
    return lines.join('\n');
  }

  const detailsMap = issueDetails instanceof Map ? issueDetails : new Map();
  const seenIssues = new Set();

  if (kanbanHits.length) {
    lines.push('', '### Совпадения по Kanban (тема / описание)');
    for (const hit of kanbanHits) {
      seenIssues.add(Number(hit.issueId));
      lines.push(
        `- #${hit.issueId} · ${hit.subject || '—'} · ${hit.project || '—'} · ${hit.status || '—'}`
        + (hit.snippet ? ` · «${hit.snippet}»` : ''),
      );
    }
  }

  if (attachmentHits.length) {
    lines.push('', '### Совпадения по файлам');
    for (const hit of attachmentHits) {
      seenIssues.add(Number(hit.issueId));
      const subj = hit.subject || detailsMap.get(Number(hit.issueId))?.subject || '—';
      lines.push(
        `- #${hit.issueId} · ${subj} · файл «${hit.filename}» · ${hit.project || '—'} · ${hit.status || '—'}`
        + (hit.attachmentId ? ` · attachmentId=${hit.attachmentId}` : ''),
      );
    }
  }

  const chunksByIssue = new Map();
  for (const c of chunks || []) {
    const id = Number(c.issueId);
    if (!id) continue;
    if (!chunksByIssue.has(id)) chunksByIssue.set(id, []);
    chunksByIssue.get(id).push(c);
  }

  if (chunksByIssue.size) {
    lines.push('', '### Совпадения по задачам');
    for (const [id, issueChunks] of chunksByIssue) {
      seenIssues.add(id);
      const issue = detailsMap.get(id);
      const metaSubject = issue?.subject || issueChunks[0]?.text?.slice(0, 80) || '—';
      lines.push('', `#### #${id} · ${metaSubject}`);
      if (issue?.status) lines.push(`- статус: ${issue.status}`);
      if (issue?.project) lines.push(`- проект: ${issue.project}`);
      const atts = issue?.attachments || [];
      if (atts.length) {
        lines.push('- вложения:');
        for (const a of atts.slice(0, 12)) {
          lines.push(`  - «${a.filename}» (id=${a.id})`);
        }
      }
      for (const c of issueChunks.slice(0, 6)) {
        if (c.type === 'attachment') {
          lines.push(`- [файл] «${c.filename || c.text}»${c.attachmentId ? ` id=${c.attachmentId}` : ''}`);
        } else {
          lines.push(`- [${c.type || 'факт'}] ${String(c.text || '').slice(0, 400)}`);
        }
      }
    }
  }

  return lines.join('\n');
}

export async function resolveReferencedIssuesForLearning(chunks = [], {
  kanbanTasks = [],
  fetchIssue,
  limit = 6,
} = {}) {
  const ids = [...new Set(
    (chunks || []).map((c) => Number(c.issueId)).filter((id) => id > 0),
  )].slice(0, limit);
  if (!ids.length) return new Map();

  const kanbanById = new Map(
    (kanbanTasks || []).map((t) => [Number(t.id), t]).filter(([id]) => id > 0),
  );
  const details = new Map();

  await Promise.all(ids.map(async (id) => {
    let issue = kanbanById.get(id) || null;
    if (typeof fetchIssue === 'function') {
      try {
        const full = await fetchIssue(id);
        if (full) issue = issue ? { ...issue, ...full } : full;
      } catch { /* partial kanban row */ }
    }
    if (issue) details.set(id, issue);
  }));

  return details;
}

export function buildLearnedExperienceBlock(chunks = [], synthesis = '', { issueDetails = null } = {}) {
  if (!chunks?.length && !synthesis) return '';
  const lines = [
    '## Релевантный опыт из прошлых задач (только факты, не выдумывать)',
    '',
    '_Формат ответа Konstancia: по каждому #issueId — **Факт из Redmine** (цитата/число) → **Вывод** → **Почему про текущую задачу** → **→ Шаг**. done_ratio ≠ часы._',
  ];

  const detailsMap = issueDetails instanceof Map ? issueDetails : new Map();
  const chunksByIssue = new Map();
  for (const c of chunks || []) {
    const id = Number(c.issueId);
    if (!id) continue;
    if (!chunksByIssue.has(id)) chunksByIssue.set(id, []);
    chunksByIssue.get(id).push(c);
  }
  const uniqueIds = [...chunksByIssue.keys()];

  if (uniqueIds.length) {
    lines.push('', '### Досье по задачам');
    for (const id of uniqueIds) {
      const issue = detailsMap.get(id);
      const subject = String(issue?.subject || chunksByIssue.get(id)?.[0]?.project || '—').slice(0, 120);
      lines.push('', `#### #${id} · ${subject}`);
      if (issue) {
        const evidence = buildIssueEvidenceBlock(issue);
        if (evidence) lines.push(evidence);
      } else {
        lines.push('_Полное досье Redmine недоступно — опирайся только на уроки ниже._');
      }
      const issueChunks = chunksByIssue.get(id) || [];
      if (issueChunks.length) {
        lines.push('Уроки из памяти по этой задаче:');
        issueChunks.forEach((c) => {
          const type = c.type || 'lesson';
          lines.push(`- [${type}] ${String(c.text || '').slice(0, 900)}`);
        });
      }
    }
  }

  if (synthesis) {
    lines.push('', '### Синтез Konstancia (черновик, проверяй по фактам выше)', synthesis.trim());
  }

  const orphanChunks = (chunks || []).filter((c) => !Number(c.issueId));
  if (orphanChunks.length) {
    lines.push('', '### Прочие уроки');
    orphanChunks.forEach((c, i) => {
      lines.push(`${i + 1}. [${c.type || 'lesson'}] ${String(c.text || '').slice(0, 900)}`);
    });
  }

  return lines.join('\n');
}

function clipEvidence(text, max = 480) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function buildIssueEvidenceBlock(issue) {
  const rows = [];
  if (issue.status) rows.push(`- статус: ${issue.status}`);
  if (issue.project) rows.push(`- проект: ${issue.project}`);
  if (issue.doneRatio != null) {
    rows.push(`- готовность (done_ratio): ${issue.doneRatio}% — это НЕ трудозатраты`);
  }
  const laborLine = buildIssueLaborLine(issue);
  if (laborLine) rows.push(`- ${laborLine}`);
  if (issue.description) {
    rows.push(`- фрагмент описания: «${clipEvidence(issue.description, 420)}»`);
  }
  if (issue.comments) {
    rows.push(`- фрагмент комментариев:\n  ${clipEvidence(issue.comments, 720).replace(/\n/g, '\n  ')}`);
  }
  return rows.length ? rows.join('\n') : '- данных Redmine мало — не выдумывай детали';
}

function buildIssueLaborLine(issue) {
  const summary = buildLaborSummaryCompact(issue);
  return summary ? `Трудозатраты: ${summary}` : 'Трудозатраты: не зафиксированы в Redmine';
}

export const PLAYBOOK_CONSOLIDATE_SYSTEM = `Сожми уроки по проекту в playbook senior-уровня: типовые риски, чеклист ТЗ, оценки времени, коммуникация с заказчиком.
Только обобщения из текстов. JSON: {"tips":["..."],"tags":["..."],"checklist":["..."]}`;
