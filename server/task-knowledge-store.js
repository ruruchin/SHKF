import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const STORE_VERSION = 2;
const DEFAULT_MAX_CHUNKS = 80000;

function emptyStore() {
  return {
    version: STORE_VERSION,
    issues: {},
    chunks: [],
    playbooks: {},
    feedback: [],
    lastConsolidationAt: null,
  };
}

export class TaskKnowledgeStore {
  constructor(userDataPath, { maxChunks = DEFAULT_MAX_CHUNKS } = {}) {
    this.dir = path.join(userDataPath, 'task-knowledge');
    this.storePath = path.join(this.dir, 'store.json');
    this.maxChunks = Math.max(500, Number(maxChunks) || DEFAULT_MAX_CHUNKS);
    this.data = emptyStore();
    this.load();
  }

  load() {
    try {
      if (!existsSync(this.storePath)) {
        this.data = emptyStore();
        return;
      }
      const parsed = JSON.parse(readFileSync(this.storePath, 'utf8'));
      this.data = {
        ...emptyStore(),
        ...parsed,
        issues: parsed?.issues && typeof parsed.issues === 'object' ? parsed.issues : {},
        chunks: Array.isArray(parsed?.chunks) ? parsed.chunks : [],
        playbooks: parsed?.playbooks && typeof parsed.playbooks === 'object' ? parsed.playbooks : {},
        feedback: Array.isArray(parsed?.feedback) ? parsed.feedback : [],
      };
    } catch {
      this.data = emptyStore();
    }
  }

  save() {
    try {
      mkdirSync(this.dir, { recursive: true });
      writeFileSync(this.storePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch {
      /* ignore disk errors */
    }
  }

  getIssueMeta(issueId) {
    return this.data.issues[String(issueId)] || null;
  }

  setIssueMeta(issueId, meta) {
    this.data.issues[String(issueId)] = { ...meta, issueId: Number(issueId) };
  }

  removeChunksForIssue(issueId) {
    const id = Number(issueId);
    this.data.chunks = this.data.chunks.filter((c) => Number(c.issueId) !== id);
  }

  addChunks(newChunks) {
    for (const chunk of newChunks) {
      this.data.chunks.push(chunk);
    }
    if (this.data.chunks.length > this.maxChunks) {
      this.data.chunks = this.data.chunks.slice(-this.maxChunks);
    }
  }

  listChunks() {
    return this.data.chunks.slice();
  }

  getPlaybook(key) {
    return this.data.playbooks[key] || null;
  }

  setPlaybook(key, playbook) {
    this.data.playbooks[key] = playbook;
  }

  addFeedback(entry) {
    this.data.feedback.push(entry);
    if (this.data.feedback.length > 500) {
      this.data.feedback = this.data.feedback.slice(-500);
    }
  }

  clearAll() {
    this.data = emptyStore();
    this.save();
  }

  stats() {
    const projects = new Set();
    let attachmentChunks = 0;
    for (const c of this.data.chunks) {
      if (c.project) projects.add(c.project);
      if (c.type === 'attachment') attachmentChunks += 1;
    }
    let attachmentsIndexed = 0;
    for (const meta of Object.values(this.data.issues || {})) {
      attachmentsIndexed += Array.isArray(meta.attachments) ? meta.attachments.length : 0;
    }
    return {
      issuesIndexed: Object.keys(this.data.issues).length,
      chunks: this.data.chunks.length,
      attachmentChunks,
      attachmentsIndexed,
      playbooks: Object.keys(this.data.playbooks).length,
      feedback: this.data.feedback.length,
      projects: projects.size,
    };
  }
}
