import {
  extractKnowledgeTokens,
  extractSearchPhrases,
  wantsReindexTasks,
} from '../shared/task-learning-intent.js';
import {
  searchKanbanTasksForKnowledge,
  formatRedmineSearchReply,
} from '../shared/task-knowledge-prompts.js';

function scoreTextMatch(hay, tokens) {
  const text = String(hay || '').toLowerCase();
  if (!text.trim() || !tokens.length) return 0;
  let score = 0;
  for (const tok of tokens) {
    if (text.includes(tok)) score += tok.length >= 6 ? 4 : 2;
  }
  return score;
}

function scoreAttachmentFilename(filename, tokens, fullQuery) {
  const name = String(filename || '').toLowerCase();
  const q = String(fullQuery || '').toLowerCase();
  let score = 0;
  if (q && name.includes(q.slice(0, 40))) score += 15;
  for (const tok of tokens) {
    if (name.includes(tok)) score += tok.length >= 5 ? 8 : 4;
  }
  return score;
}

/**
 * Full Redmine file / topic search — no LLM, real API + local index only.
 */
export async function runRedmineFileSearch({
  query = '',
  kanbanTasks = [],
  metaskService,
  taskKnowledgeService,
  userId = null,
} = {}) {
  const q = String(query || '').trim();
  if (!q) {
    return { ok: false, message: 'Пустой запрос' };
  }

  if (wantsReindexTasks(q)) {
    const list = kanbanTasks || [];
    taskKnowledgeService.startBackgroundReindex(list, userId, { liteOnly: true, force: true });
    return {
      ok: true,
      content: [
        `Запустил индексацию **${list.length}** задач Kanban в фоне.`,
        '',
        'Повторите поиск через 1–2 минуты — подтянутся вложения.',
      ].join('\n'),
      indexingStatus: { started: true, total: list.length },
    };
  }

  let indexingStatus = null;
  const statsBefore = taskKnowledgeService.listLearnedSummary();
  if (statsBefore.issuesIndexed < Math.min((kanbanTasks || []).length, 20)) {
    indexingStatus = await taskKnowledgeService.ensureCatalogCoverage(
      kanbanTasks,
      userId,
      { maxBatch: 80 },
    );
  }

  const tokens = extractKnowledgeTokens(q);
  let apiHits = [];
  try {
    apiHits = await metaskService.searchIssuesForKnowledge(q, { limit: 40 });
  } catch {
    apiHits = [];
  }

  const kanbanHits = searchKanbanTasksForKnowledge(q, kanbanTasks, { limit: 15 });
  const metaHits = taskKnowledgeService.searchIssueMeta(q, { limit: 15 });
  let chunks = await taskKnowledgeService.retrieveForAgent(q, { limit: 20, preferAttachments: true });
  let attachmentHits = taskKnowledgeService.searchAttachments(q, { limit: 20 });

  const candidateIds = new Set();
  for (const src of [apiHits, kanbanHits, metaHits, attachmentHits, chunks]) {
    for (const row of src || []) {
      const id = Number(row.issueId || row.id);
      if (id) candidateIds.add(id);
    }
  }

  for (const hit of apiHits.slice(0, 15)) {
    try {
      await taskKnowledgeService.indexIssue(hit.issueId, {
        listTask: {
          id: hit.issueId,
          subject: hit.subject,
          description: hit.description || hit.snippet || '',
          project: hit.project,
          status: hit.status,
          url: hit.url,
        },
        liteOnly: true,
      });
    } catch { /* continue */ }
  }

  attachmentHits = taskKnowledgeService.searchAttachments(q, { limit: 25 });
  chunks = await taskKnowledgeService.retrieveForAgent(q, { limit: 20, preferAttachments: true });

  const issueDetails = new Map();
  const ids = [...candidateIds].slice(0, 18);
  await Promise.all(ids.map(async (id) => {
    const fromKanban = (kanbanTasks || []).find((t) => Number(t.id) === id);
    try {
      const full = await metaskService.fetchIssueForAgent(id);
      if (full) {
        issueDetails.set(id, full);
        return;
      }
    } catch { /* fallback kanban row */ }
    if (fromKanban) issueDetails.set(id, fromKanban);
  }));

  for (const [id, issue] of issueDetails) {
    const attachments = issue.attachments || [];
    const subScore = scoreTextMatch(`${issue.subject} ${issue.description}`, tokens);
    const fromApi = apiHits.some((h) => Number(h.issueId) === id);
    for (const att of attachments) {
      const fnScore = scoreAttachmentFilename(att.filename, tokens, q);
      if (fnScore <= 0 && subScore <= 0 && !fromApi) continue;
      const exists = attachmentHits.some(
        (h) => Number(h.issueId) === id && Number(h.attachmentId) === Number(att.id),
      );
      if (exists) continue;
      attachmentHits.push({
        score: fnScore + subScore + 10,
        issueId: id,
        attachmentId: att.id,
        filename: att.filename,
        contentUrl: att.contentUrl,
        subject: issue.subject,
        project: issue.project,
        status: issue.status,
        text: `Файл «${att.filename}» в #${id}`,
      });
    }
  }

  attachmentHits.sort((a, b) => (b.score || 0) - (a.score || 0));

  const stats = taskKnowledgeService.listLearnedSummary();
  const content = formatRedmineSearchReply({
    query: q,
    kanbanHits,
    metaHits,
    attachmentHits,
    apiHits,
    chunks,
    issueDetails,
    stats,
    indexingStatus,
    kanbanCount: (kanbanTasks || []).length,
  });

  return {
    ok: true,
    content,
    direct: true,
    stats,
    indexingStatus,
    candidateCount: candidateIds.size,
  };
}
