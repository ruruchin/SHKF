import { createHash, randomUUID } from 'crypto';
import { resolveKnowledgeModel, knowledgeChatParams } from '../shared/gigachat-knowledge.js';
import {
  TASK_DISTILL_SYSTEM,
  TASK_RETRIEVAL_SYNTHESIS_SYSTEM,
  buildTaskDistillUserMessage,
  PLAYBOOK_CONSOLIDATE_SYSTEM,
} from '../shared/task-knowledge-prompts.js';
import { buildLaborSummaryCompact } from '../shared/labor-costs.js';
import { extractKnowledgeTokens } from '../shared/task-learning-intent.js';
import { assertNoMetaskWrite } from './metask-readonly.js';
import { TaskKnowledgeStore } from './task-knowledge-store.js';

function clip(text, max = 800) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function listContentHash(issue) {
  const payload = [
    issue.subject,
    issue.description,
    issue.status,
    issue.updatedOn,
  ].join('\n');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function contentHash(issue) {
  const att = (issue.attachments || [])
    .map((a) => `${a.id || ''}:${a.filename || ''}`)
    .join('|');
  const payload = [
    issue.subject,
    issue.description,
    issue.comments,
    issue.status,
    issue.updatedOn,
    att,
  ].join('\n');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function extractJsonObject(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const CLOSED_STATUS_RE = /закры|closed|resolved|решен|принят|accepted|выполн|done|отклон|reject|cancel|отмен|внедр|implement/i;

export class TaskKnowledgeService {
  constructor(userDataPath, deps = {}) {
    this.store = new TaskKnowledgeStore(userDataPath);
    this.metaskReadOnly = deps.metaskReadOnly || null;
    this.metaskWrite = deps.metaskService || null;
    this.agentService = deps.agentService || null;
    this.authService = deps.authService || null;
    this.settings = {
      enabled: true,
      scope: 'all_visible',
      maxIssuesPerSync: 100,
      distillOnClose: true,
      indexComments: true,
      indexAttachments: true,
      catalogOnlyOnSync: true,
      maxChunks: 80000,
      cloudSync: false,
    };
    this._indexQueue = [];
    this._indexing = false;
  }

  configure(settings = {}) {
    this.settings = {
      ...this.settings,
      ...settings,
      enabled: settings.enabled !== false,
      maxIssuesPerSync: Math.max(1, Math.min(300, Number(settings.maxIssuesPerSync) || 100)),
      maxChunks: Math.max(1000, Math.min(250000, Number(settings.maxChunks) || 80000)),
    };
    if (this.store) {
      this.store.maxChunks = this.settings.maxChunks;
    }
  }

  setMetaskReadOnly(readOnly) {
    this.metaskReadOnly = readOnly;
  }

  issueInScope(task, userId) {
    if (!task?.id) return false;
    const scope = this.settings.scope || 'assigned';
    if (scope === 'all_visible') return true;
    if (scope === 'assigned') {
      const uid = Number(userId);
      if (!uid) return task.involvement === 'assigned' || !task.assignees?.length;
      return (task.assignees || []).some((a) => Number(a.id) === uid)
        || task.involvement === 'assigned';
    }
    if (Array.isArray(scope)) {
      const projects = scope.map((p) => String(p).toLowerCase());
      return projects.includes(String(task.project || '').toLowerCase());
    }
    return true;
  }

  async fetchIssueReadOnly(issueId) {
    assertNoMetaskWrite('fetch');
    const ro = this.metaskReadOnly;
    if (!ro?.fetchIssueForAgent) return null;
    return ro.fetchIssueForAgent(Number(issueId));
  }

  shouldReindex(issue) {
    const id = String(issue.id);
    const prev = this.store.getIssueMeta(id);
    if (!prev) return true;
    if (this.settings.indexAttachments !== false && !Array.isArray(prev.attachments)) return true;
    if (prev.listContentVersion !== listContentHash(issue)) return true;
    if (Array.isArray(issue.attachments) && prev.contentVersion !== contentHash(issue)) return true;
    if (this.settings.distillOnClose && CLOSED_STATUS_RE.test(issue.status || '') && !prev.distilledOnClose) {
      return true;
    }
    return false;
  }

  enqueueFromSync({ tasks = [], updates = [], userId = null } = {}) {
    if (!this.settings.enabled) return { queued: 0 };
    const updateIds = new Set((updates || []).map((t) => Number(t.id)));
    const inScope = (tasks || []).filter((t) => this.issueInScope(t, userId));
    const candidates = inScope.filter((t) => {
      return updateIds.has(Number(t.id)) || this.shouldReindex(t);
    });
    const neverIndexed = inScope.filter((t) => !this.store.getIssueMeta(t.id));
    const merged = [];
    const seen = new Set();
    for (const task of [...candidates, ...neverIndexed]) {
      const id = Number(task.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(task);
    }
    const limit = this.settings.maxIssuesPerSync;
    let queued = 0;
    for (const task of merged.slice(0, limit)) {
      if (!this._indexQueue.some((q) => q.id === task.id)) {
        const fullDistill = updateIds.has(Number(task.id))
          && !this.settings.catalogOnlyOnSync;
        this._indexQueue.push({ ...task, _liteOnly: this.settings.catalogOnlyOnSync && !fullDistill });
        queued += 1;
      }
    }
    this.drainQueue().catch(() => {});
    return { queued, pending: Math.max(0, merged.length - limit) };
  }

  async drainQueue() {
    if (this._indexing || !this._indexQueue.length) return;
    this._indexing = true;
    try {
      while (this._indexQueue.length) {
        const task = this._indexQueue.shift();
        await this.indexIssue(task.id, {
          listTask: task,
          liteOnly: task._liteOnly === true,
        });
        await new Promise((r) => setTimeout(r, 120));
      }
    } finally {
      this._indexing = false;
    }
  }

  shouldDistill(issue, force = false) {
    if (force) return true;
    if (!this.agentService?.isConfigured?.()) return false;
    const prev = this.store.getIssueMeta(issue.id);
    if (this.settings.distillOnClose && CLOSED_STATUS_RE.test(issue.status || '') && !prev?.distilledOnClose) {
      return true;
    }
    return false;
  }

  async indexIssue(issueId, { listTask = null, force = false, liteOnly = false } = {}) {
    if (!this.settings.enabled) return { ok: false, message: 'learning-disabled' };
    const id = Number(issueId);
    if (!id) return { ok: false, message: 'invalid-id' };

    let issue = await this.fetchIssueReadOnly(id);
    if (!issue && listTask) {
      issue = {
        ...listTask,
        description: listTask.description || '',
        comments: '',
        laborJournal: [],
        laborTimeEntries: [],
        attachments: [],
      };
    }
    if (!issue) return { ok: false, message: 'issue-not-found' };

    const ver = contentHash(issue);
    if (!force && !this.shouldReindex(issue)) {
      return { ok: true, skipped: true, issueId: id };
    }

    if (!this.settings.indexComments) {
      issue = { ...issue, comments: '' };
    }

    const catalogChunks = this.buildCatalogChunks(issue);
    let distillChunks = [];
    const runDistill = !liteOnly && this.shouldDistill(issue, force);
    if (runDistill) {
      const distilled = await this.distillIssue(issue);
      distillChunks = this.buildChunksFromDistill(issue, distilled);
    }

    this.store.removeChunksForIssue(id);
    const chunks = [...catalogChunks, ...distillChunks];
    await this.embedChunks(chunks);
    this.store.addChunks(chunks);
    this.store.setIssueMeta(id, {
      issueId: id,
      project: issue.project || '',
      tracker: issue.tracker || '',
      status: issue.status || '',
      subject: clip(issue.subject, 200),
      url: issue.url || listTask?.url || '',
      listContentVersion: listContentHash(issue),
      contentVersion: ver,
      lastIndexedAt: new Date().toISOString(),
      distilledOnClose: CLOSED_STATUS_RE.test(issue.status || '') || !!this.store.getIssueMeta(id)?.distilledOnClose,
      chunkCount: chunks.length,
      attachments: (issue.attachments || []).map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.contentType || a.content_type || '',
        contentUrl: a.contentUrl || '',
        size: a.size || null,
      })),
    });
    this.store.save();

    if (this.settings.cloudSync) {
      this.syncChunksToSupabase(chunks).catch(() => {});
    }

    await this.maybeUpdatePlaybook(issue.project);

    return { ok: true, issueId: id, chunks: chunks.length };
  }

  async distillIssue(issue) {
    if (!this.agentService?.isConfigured?.()) {
      return { lessons: [], risks: [], reusableTips: [], deliverable: 'unknown' };
    }
    const model = resolveKnowledgeModel(this.agentService.settings?.model);
    const params = knowledgeChatParams({ smart: true });

    const result = await this.agentService.chat({
      message: buildTaskDistillUserMessage(issue),
      history: [],
      task: null,
      systemPrompt: TASK_DISTILL_SYSTEM,
      allowFollowups: false,
      ...params,
      modelOverride: model,
    });

    if (!result?.ok) {
      return {
        lessons: [{
          type: 'summary',
          text: clip(`${issue.subject}. ${issue.description || ''}`, 500),
          tags: [issue.project, issue.tracker].filter(Boolean),
        }],
        risks: [],
        reusableTips: [],
        deliverable: 'unknown',
        distillError: result?.message,
      };
    }

    const parsed = extractJsonObject(result.content) || {};
    const extraPatterns = Array.isArray(parsed.processPatterns) ? parsed.processPatterns : [];
    const lessons = Array.isArray(parsed.lessons) ? [...parsed.lessons] : [];
    for (const p of extraPatterns.slice(0, 4)) {
      const text = clip(p, 400);
      if (text) lessons.push({ type: 'labor_pattern', text, tags: ['pattern'] });
    }
    if (parsed.estimateAccuracy && parsed.estimateAccuracy !== 'unknown') {
      lessons.push({
        type: 'labor_pattern',
        text: `Точность оценки по задаче: ${parsed.estimateAccuracy}`,
        tags: ['estimate'],
      });
    }

    return {
      lessons,
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      reusableTips: Array.isArray(parsed.reusableTips) ? parsed.reusableTips : [],
      deliverable: parsed.deliverable || 'unknown',
    };
  }

  async synthesizeRetrieval(query, chunks = [], task = null, issueDetails = null) {
    const list = (chunks || []).filter((c) => c?.text);
    if (!list.length || !this.agentService?.isConfigured?.()) return '';

    const model = resolveKnowledgeModel(this.agentService.settings?.model);
    const params = knowledgeChatParams({ smart: true });
    const detailsMap = issueDetails instanceof Map ? issueDetails : new Map();

    const body = list.map((c, i) => {
      const id = Number(c.issueId);
      const issue = id ? detailsMap.get(id) : null;
      const subject = issue?.subject ? ` «${String(issue.subject).slice(0, 80)}»` : '';
      const labor = issue ? buildLaborSummaryCompact(issue) : '';
      const laborPart = labor ? ` · ${labor}` : '';
      const donePart = issue?.doneRatio != null ? ` · готовность ${issue.doneRatio}%` : '';
      return `${i + 1}. #${c.issueId || '?'}${subject} [${c.type}]${laborPart}${donePart}: ${clip(c.text, 450)}`;
    }).join('\n');

    const taskLines = task?.id
      ? [
        `Текущая задача #${task.id}: ${task.subject || ''}`,
        task.description ? `Описание текущей: ${clip(String(task.description).replace(/\s+/g, ' '), 600)}` : '',
      ].filter(Boolean).join('\n')
      : 'Текущая задача не выбрана';

    const result = await this.agentService.chat({
      message: [
        taskLines,
        `Запрос пользователя: ${clip(query, 500)}`,
        '',
        'Уроки из памяти (связывай с текущей задачей через конкретные слова из описания):',
        body,
      ].join('\n'),
      history: [],
      systemPrompt: TASK_RETRIEVAL_SYNTHESIS_SYSTEM,
      allowFollowups: false,
      ...params,
      modelOverride: model,
    });

    return result?.ok ? String(result.content || '').trim() : '';
  }

  buildChunksFromDistill(issue, distilled) {
    const chunks = [];
    const base = {
      issueId: issue.id,
      project: issue.project || '',
      tracker: issue.tracker || '',
      source: 'distill',
      createdAt: new Date().toISOString(),
      deliverable: distilled.deliverable || 'unknown',
    };

    for (const lesson of distilled.lessons || []) {
      const text = clip(lesson.text, 800);
      if (!text) continue;
      chunks.push({
        id: randomUUID(),
        ...base,
        type: lesson.type || 'summary',
        text,
        tags: Array.isArray(lesson.tags) ? lesson.tags.map(String) : [],
        embedding: null,
      });
    }

    for (const tip of distilled.reusableTips || []) {
      const text = clip(tip, 400);
      if (!text) continue;
      chunks.push({
        id: randomUUID(),
        ...base,
        type: 'tip',
        text,
        tags: ['reusable'],
        embedding: null,
      });
    }

    if (!chunks.length) {
      chunks.push({
        id: randomUUID(),
        ...base,
        type: 'summary',
        text: clip(`${issue.subject}. ${issue.description || '(без описания)'}`, 600),
        tags: [issue.project, issue.tracker].filter(Boolean),
        embedding: null,
      });
    }

    return chunks;
  }

  buildCatalogChunks(issue) {
    const chunks = [];
    const base = {
      issueId: issue.id,
      project: issue.project || '',
      tracker: issue.tracker || '',
      source: 'catalog',
      createdAt: new Date().toISOString(),
      deliverable: 'unknown',
    };

    const subject = String(issue.subject || '').trim();
    const description = String(issue.description || '').trim();
    const status = String(issue.status || '').trim();
    const summaryText = [
      subject,
      description ? description.slice(0, 1200) : '',
      status ? `Статус: ${status}` : '',
      issue.project ? `Проект: ${issue.project}` : '',
      issue.tracker ? `Трекер: ${issue.tracker}` : '',
    ].filter(Boolean).join('. ');

    chunks.push({
      id: randomUUID(),
      ...base,
      type: 'summary',
      text: clip(summaryText, 900),
      tags: [issue.project, issue.tracker, issue.status].filter(Boolean).map(String),
      embedding: null,
    });

    if (this.settings.indexAttachments !== false) {
      for (const att of issue.attachments || []) {
        const filename = String(att.filename || '').trim();
        if (!filename) continue;
        const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
        const desc = String(att.description || '').trim();
        chunks.push({
          id: randomUUID(),
          ...base,
          type: 'attachment',
          attachmentId: att.id || null,
          filename,
          contentUrl: att.contentUrl || '',
          text: clip(
            `Вложение «${filename}» в задаче #${issue.id} «${subject}». ${desc || ''}`.trim(),
            600,
          ),
          tags: [filename, ext, issue.project, 'attachment'].filter(Boolean).map(String),
          embedding: null,
        });
      }
    }

    if (issue.comments && this.settings.indexComments !== false) {
      chunks.push({
        id: randomUUID(),
        ...base,
        type: 'comments',
        text: clip(`Комментарии задачи #${issue.id}: ${issue.comments}`, 900),
        tags: [issue.project, 'comments'].filter(Boolean).map(String),
        embedding: null,
      });
    }

    return chunks;
  }

  async embedChunks(chunks) {
    if (!this.agentService?.embed || !chunks.length) return;
    const texts = chunks.map((c) => `${c.type}: ${c.text}`);
    const vectors = await this.agentService.embed(texts);
    if (!vectors || vectors.length !== chunks.length) return;
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = vectors[i];
    }
  }

  async search(query, { project = '', tracker = '', limit = 5, types = null } = {}) {
    if (!this.settings.enabled) return [];
    const q = String(query || '').trim();
    if (!q) return [];

    let chunks = this.store.listChunks();
    if (project) {
      chunks = chunks.filter((c) => !c.project || c.project === project);
    }
    if (tracker) {
      chunks = chunks.filter((c) => !c.tracker || c.tracker === tracker);
    }
    if (Array.isArray(types) && types.length) {
      const typeSet = new Set(types.map(String));
      chunks = chunks.filter((c) => typeSet.has(c.type));
    }

    const feedbackBoost = this.buildFeedbackWeights();
    const needEmbed = chunks.some((c) => !c.embedding);
    if (needEmbed && this.agentService?.embed) {
      const batch = chunks.filter((c) => !c.embedding).slice(0, 30);
      await this.embedChunks(batch);
      this.store.save();
    }

    let queryVec = null;
    if (this.agentService?.embed) {
      const ev = await this.agentService.embed([q]);
      queryVec = ev?.[0] || null;
    }

    const scored = chunks.map((chunk) => {
      let score = 0;
      if (queryVec && Array.isArray(chunk.embedding)) {
        score = cosineSimilarity(queryVec, chunk.embedding);
      } else {
        const tokens = extractKnowledgeTokens(q);
        const fallback = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
        const searchTokens = tokens.length ? tokens : fallback;
        const hay = `${chunk.text} ${(chunk.tags || []).join(' ')}`.toLowerCase();
        score = searchTokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0) / Math.max(1, searchTokens.length);
      }
      const fb = feedbackBoost.get(chunk.id);
      if (fb === 'up') score += 0.15;
      if (fb === 'down') score -= 0.25;
      if (chunk.suppressed) score -= 1;
      if (chunk.boosted) score += 0.2;
      return { chunk, score };
    });

    return scored
      .filter((x) => x.score > 0.02)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(20, Number(limit) || 5)))
      .map((x) => x.chunk);
  }

  searchIssueMeta(query, { limit = 10 } = {}) {
    const tokens = extractKnowledgeTokens(query);
    if (!tokens.length) return [];
    const hits = [];
    for (const meta of Object.values(this.store.data.issues || {})) {
      if (!meta?.issueId) continue;
      const attNames = (meta.attachments || []).map((a) => a.filename).join(' ');
      const hay = `${meta.subject || ''} ${meta.project || ''} ${meta.status || ''} ${attNames}`.toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (hay.includes(tok)) score += tok.length >= 6 ? 3 : 2;
      }
      if (score <= 0) continue;
      hits.push({
        score,
        issueId: meta.issueId,
        subject: meta.subject || '',
        project: meta.project || '',
        status: meta.status || '',
        url: meta.url || '',
        attachments: meta.attachments || [],
      });
    }
    return hits
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(15, Number(limit) || 10)));
  }

  async ensureCatalogCoverage(tasks = [], userId = null, { maxBatch = 60 } = {}) {
    const list = (tasks || []).filter((t) => this.issueInScope(t, userId));
    const missing = list.filter((t) => !this.store.getIssueMeta(t.id));
    if (!missing.length) {
      return { indexed: 0, pending: 0, total: list.length, started: false };
    }
    const batch = missing.slice(0, maxBatch);
    let indexed = 0;
    for (const task of batch) {
      const r = await this.indexIssue(task.id, { listTask: task, force: true, liteOnly: true });
      if (r?.ok && !r.skipped) indexed += 1;
      await new Promise((res) => setTimeout(res, 90));
    }
    return {
      indexed,
      pending: Math.max(0, missing.length - batch.length),
      total: list.length,
      started: true,
    };
  }

  startBackgroundReindex(tasks = [], userId = null, { onProgress = null } = {}) {
    const list = (tasks || []).filter((t) => this.issueInScope(t, userId));
    if (!list.length) return { ok: true, total: 0 };
    this.reindexAll(list, userId, {
      liteOnly: true,
      force: true,
      onProgress,
    }).catch(() => {});
    return { ok: true, total: list.length };
  }

  searchAttachments(query, { limit = 12 } = {}) {
    const tokens = extractKnowledgeTokens(query);
    const q = String(query || '').trim().toLowerCase();
    if (!q && !tokens.length) return [];
    const searchTokens = tokens.length ? tokens : q.split(/\s+/).filter((w) => w.length >= 2);
    const hits = [];

    for (const chunk of this.store.listChunks()) {
      if (chunk.type !== 'attachment') continue;
      const filename = String(chunk.filename || '').toLowerCase();
      const hay = `${filename} ${chunk.text || ''} ${(chunk.tags || []).join(' ')}`.toLowerCase();
      let score = 0;
      if (filename.includes(q)) score += 3;
      for (const t of searchTokens) {
        if (filename.includes(t)) score += 2;
        else if (hay.includes(t)) score += 1;
      }
      if (score <= 0) continue;
      const meta = this.store.getIssueMeta(chunk.issueId);
      hits.push({
        score,
        issueId: chunk.issueId,
        attachmentId: chunk.attachmentId,
        filename: chunk.filename,
        contentUrl: chunk.contentUrl || meta?.attachments?.find((a) => a.id === chunk.attachmentId)?.contentUrl || '',
        subject: meta?.subject || '',
        project: chunk.project || meta?.project || '',
        status: meta?.status || '',
        url: meta?.url || '',
        text: chunk.text,
      });
    }

    return hits
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(20, Number(limit) || 12)));
  }

  getIssueCatalog(issueId) {
    return this.store.getIssueMeta(Number(issueId)) || null;
  }

  buildFeedbackWeights() {
    const map = new Map();
    for (const fb of this.store.data.feedback || []) {
      for (const cid of fb.chunkIds || []) {
        map.set(cid, fb.vote);
      }
    }
    return map;
  }

  recordFeedback({ messageId, vote, chunkIds = [] }) {
    this.store.addFeedback({
      id: randomUUID(),
      messageId: messageId || null,
      vote: vote === 'down' ? 'down' : 'up',
      chunkIds: chunkIds.slice(0, 20),
      at: new Date().toISOString(),
    });
    for (const cid of chunkIds) {
      const chunk = this.store.data.chunks.find((c) => c.id === cid);
      if (!chunk) continue;
      if (vote === 'up') chunk.boosted = true;
      if (vote === 'down') chunk.suppressed = true;
    }
    this.store.save();
    return { ok: true };
  }

  pinLesson({ text, issueId = null, project = '' }) {
    const chunk = {
      id: randomUUID(),
      issueId: issueId ? Number(issueId) : null,
      project: project || '',
      tracker: '',
      type: 'user_confirmed',
      text: clip(text, 800),
      tags: ['pinned'],
      source: 'user_confirmed',
      boosted: true,
      createdAt: new Date().toISOString(),
      embedding: null,
    };
    this.store.addChunks([chunk]);
    this.store.save();
    return { ok: true, chunkId: chunk.id };
  }

  async maybeUpdatePlaybook(project) {
    const key = String(project || '').trim() || '_global';
    const projectChunks = this.store.listChunks().filter((c) => (c.project || '_global') === key || c.project === project);
    if (projectChunks.length < 3) return;

    const now = Date.now();
    const prev = this.store.getPlaybook(key);
    if (prev?.updatedAt && now - new Date(prev.updatedAt).getTime() < 86_400_000) return;

    const sample = projectChunks.slice(-15).map((c) => c.text).join('\n- ');
    if (!this.agentService?.isConfigured?.()) return;

    const model = resolveKnowledgeModel(this.agentService.settings?.model);
    const result = await this.agentService.chat({
      message: `Проект: ${project || 'общий'}\nУроки:\n- ${sample}`,
      history: [],
      systemPrompt: PLAYBOOK_CONSOLIDATE_SYSTEM,
      allowFollowups: false,
      ...knowledgeChatParams({ smart: true }),
      modelOverride: model,
    });

    if (!result?.ok) return;
    const parsed = extractJsonObject(result.content);
    if (!parsed?.tips?.length) return;

    this.store.setPlaybook(key, {
      project: project || '',
      tips: parsed.tips.slice(0, 8),
      tags: parsed.tags || [],
      updatedAt: new Date().toISOString(),
    });
    this.store.data.lastConsolidationAt = new Date().toISOString();
    this.store.save();
  }

  getPlaybook(project) {
    const key = String(project || '').trim() || '_global';
    return this.store.getPlaybook(key);
  }

  listLearnedSummary() {
    return this.store.stats();
  }

  async reindexAll(tasks = [], userId = null, { onProgress = null, liteOnly = true, force = true } = {}) {
    const list = (tasks || []).filter((t) => this.issueInScope(t, userId));
    let done = 0;
    let skipped = 0;
    const total = list.length;
    for (let i = 0; i < list.length; i += 1) {
      const task = list[i];
      const r = await this.indexIssue(task.id, { listTask: task, force, liteOnly });
      if (r?.ok && !r.skipped) done += 1;
      else if (r?.skipped) skipped += 1;
      if (typeof onProgress === 'function') {
        onProgress({
          current: i + 1,
          total,
          indexed: done,
          skipped,
          issueId: task.id,
        });
      }
      await new Promise((res) => setTimeout(res, 150));
    }
    return { ok: true, indexed: done, skipped, total };
  }

  clearLocal() {
    this.store.clearAll();
    return { ok: true };
  }

  vectorLiteral(vec) {
    return `[${(Array.isArray(vec) ? vec : []).map((n) => Number(n) || 0).join(',')}]`;
  }

  async syncChunksToSupabase(chunks) {
    if (!this.settings.cloudSync || !this.authService?.client || !chunks?.length) return;
    await this.authService.ensureClientSession?.().catch(() => {});
    const userId = this.authService.session?.user?.id;
    if (!userId) return;

    for (const chunk of chunks.slice(0, 10)) {
      if (!chunk.embedding?.length) continue;
      try {
        await this.authService.client.from('task_knowledge_chunks').upsert({
          id: chunk.id,
          issue_id: chunk.issueId,
          project: chunk.project || '',
          chunk_type: chunk.type || 'summary',
          body: chunk.text,
          tags: chunk.tags || [],
          deliverable: chunk.deliverable || 'unknown',
          created_by: userId,
        }, { onConflict: 'id' });

        await this.authService.client.from('task_knowledge_embeddings').upsert({
          chunk_id: chunk.id,
          model: 'Embeddings',
          embedding: this.vectorLiteral(chunk.embedding),
        }, { onConflict: 'chunk_id' });
      } catch {
        /* offline */
      }
    }
  }

  async searchSupabase(query, { limit = 5 } = {}) {
    if (!this.settings.cloudSync || !this.authService?.client) return [];
    const vectors = await this.agentService?.embed?.([query]);
    const qv = vectors?.[0];
    if (!qv?.length) return [];

    try {
      const { data, error } = await this.authService.client.rpc('match_task_knowledge', {
        query_embedding_text: this.vectorLiteral(qv),
        match_count: Math.max(1, Math.min(10, limit)),
      });
      if (error || !Array.isArray(data)) return [];
      return data.map((row) => ({
        id: row.id,
        issueId: row.issue_id,
        project: row.project,
        type: row.chunk_type,
        text: row.body,
        tags: row.tags || [],
        similarity: Number(row.similarity || 0),
      }));
    } catch {
      return [];
    }
  }

  async retrieveForAgent(query, { task = null, limit = 8, preferAttachments = false } = {}) {
    const project = task?.project || '';
    const attachmentHits = preferAttachments ? this.searchAttachments(query, { limit: 8 }) : [];
    const attachmentChunks = attachmentHits.map((h) => ({
      id: `att-${h.issueId}-${h.attachmentId}`,
      issueId: h.issueId,
      project: h.project,
      type: 'attachment',
      text: h.text || `Файл ${h.filename} в #${h.issueId}`,
      filename: h.filename,
      attachmentId: h.attachmentId,
      contentUrl: h.contentUrl,
      tags: ['attachment', h.filename].filter(Boolean),
    }));

    const local = await this.search(query, {
      project,
      limit: preferAttachments ? Math.max(4, limit - attachmentChunks.length) : limit,
    });
    const remote = await this.searchSupabase(query, { limit }).catch(() => []);
    const merged = [...attachmentChunks, ...remote, ...local];
    const seen = new Set();
    return merged.filter((c) => {
      const k = c.id || `${c.issueId}-${c.type}-${c.text?.slice(0, 40)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, Math.max(1, Math.min(20, Number(limit) || 8)));
  }

  async retrieveForAgentWithContext(query, options = {}) {
    const chunks = await this.retrieveForAgent(query, options);
    const issueDetails = options.issueDetails || null;
    const synthesis = options.withSynthesis !== false
      ? await this.synthesizeRetrieval(query, chunks, options.task, issueDetails)
      : '';
    return { chunks, synthesis };
  }
}
