import { session, app } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { stripRedmineText } from '../shared/redmine-text.js';
import {
  parseLaborFromJournals,
  mapTimeEntries,
  formatLaborLogNotes,
} from '../shared/labor-costs.js';
import {
  isActiveNotImplementedIssue,
  CHECKLIST_ISSUE_FILTER_KEYS,
  CHECKLIST_ITEM_INDEX_PATHS,
  parseMyOpenChecklistItems,
  extractIssueIdsFromChecklistIndex,
  groupChecklistItemsByIssue,
  mergePersonalIssueLists,
} from '../shared/metask-personal.js';
import { extractSearchPhrases } from '../shared/task-learning-intent.js';

function trimSlash(url) {
  return (url || '').replace(/\/+$/, '');
}

function normalizeBaseUrl(url) {
  let raw = (url || '').trim();
  if (!raw) return '';
  raw = raw.replace(/\/\/m\.cinet\.ru/gi, '//rm.cinet.ru');
  raw = raw.replace(/\/\/rm\.cinct\.ru/gi, '//rm.cinet.ru');
  raw = raw.replace(/\/kanban\b.*/i, '');
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (parsed.hostname === 'm.cinet.ru') parsed.hostname = 'rm.cinet.ru';
    if (parsed.hostname === 'rm.cinct.ru') parsed.hostname = 'rm.cinet.ru';
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

function normalizeIso(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString();
  } catch {
    return String(iso);
  }
}

function buildTasksFetchScript(userId) {
  const assignee = userId ? String(userId) : 'me';
  return `
(async () => {
  const isActive = (issue) => {
    if (issue?.status?.is_closed === true) return false;
    const name = (issue?.status?.name || '').toLowerCase();
    if (/внедр|implement|deployed|release|released/.test(name)) return false;
    if (/закры|closed|resolved|решен|принят|accepted|выполн|done|отклон|reject|cancel|отмен|archived|archive/.test(name)) return false;
    return true;
  };
  const all = [];
  let offset = 0;
  const limit = 100;
  let total = Infinity;
  while (offset < total) {
    const q = 'assigned_to_id=${assignee}&status_id=open&limit=' + limit + '&offset=' + offset + '&sort=updated_on:desc&include=watchers';
    const issuesRes = await fetch('/issues.json?' + q, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!issuesRes.ok) return offset === 0 ? { ok: false, status: issuesRes.status } : { ok: true, issues: all, user: null };
    const issuesData = await issuesRes.json();
    const batch = issuesData.issues || [];
    all.push(...batch);
    total = issuesData.total_count ?? all.length;
    offset += batch.length;
    if (!batch.length) break;
  }
  let user = null;
  let uid = ${userId ? String(userId) : 'null'};
  try {
    const userRes = await fetch('/users/current.json', {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (userRes.ok) {
      const u = await userRes.json();
      if (u.user) {
        uid = u.user.id;
        user = ((u.user.firstname || '') + ' ' + (u.user.lastname || '')).trim() || u.user.login;
      }
    }
  } catch {}
  const assigned = all.filter((issue) => (!uid || issue.assigned_to?.id === uid) && isActive(issue));
  const assignedIds = new Set(assigned.map((i) => i.id));
  const filterKeys = ${JSON.stringify(CHECKLIST_ISSUE_FILTER_KEYS)};
  const candidates = new Map();
  for (const key of filterKeys) {
    try {
      const r = await fetch('/issues.json?status_id=open&limit=100&sort=updated_on:desc&' + key + '=' + uid, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!r.ok) continue;
      const data = await r.json();
      for (const issue of data.issues || []) {
        if (!issue?.id || assignedIds.has(issue.id) || !isActive(issue)) continue;
        if (issue.assigned_to?.id === uid) continue;
        candidates.set(issue.id, issue);
      }
    } catch {}
  }
  const collectMyItems = (json) => {
    const myItems = [];
    const seen = new Set();
    const collectItems = (node, depth) => {
      if (!node || depth > 12) return;
      if (Array.isArray(node)) {
        node.forEach((c) => collectItems(c, depth + 1));
        return;
      }
      if (typeof node !== 'object') return;
      const assigned = node.assigned_to_id ?? node.assigned_to?.id ?? node.assignee_id;
      const title = node.title ?? node.subject ?? node.name;
      const id = node.id ?? node.question_id;
      const done = node.done === true || node.is_done === true || node.is_done === 1 || node.completed === true;
      if (id && title && Number(assigned) === Number(uid) && !done) {
        const key = String(id) + ':' + String(title);
        if (!seen.has(key)) {
          seen.add(key);
          myItems.push({ title: String(title).trim() });
        }
      }
      Object.values(node).forEach((v) => {
        if (v && typeof v === 'object') collectItems(v, depth + 1);
      });
    };
    collectItems(json, 0);
    return myItems;
  };
  const indexPaths = ${JSON.stringify(CHECKLIST_ITEM_INDEX_PATHS)};
  for (const path of indexPaths) {
    try {
      const r = await fetch(path + '?assigned_to_id=' + uid + '&limit=100&is_done=0', {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!r.ok) continue;
      const data = await r.json();
      const walkIssueIds = (node, depth) => {
        if (!node || depth > 10) return;
        if (Array.isArray(node)) {
          node.forEach((c) => walkIssueIds(c, depth + 1));
          return;
        }
        if (typeof node !== 'object') return;
        const issueId = node.issue_id ?? node.issue?.id;
        if (issueId && !assignedIds.has(issueId)) {
          candidates.set(issueId, { id: issueId, assigned_to: node.issue?.assigned_to || null, status: node.issue?.status || { name: '—' }, subject: node.issue?.subject || ('Задача #' + issueId), updated_on: node.issue?.updated_on || '', project: node.issue?.project, tracker: node.issue?.tracker, priority: node.issue?.priority });
        }
        Object.values(node).forEach((v) => {
          if (v && typeof v === 'object') walkIssueIds(v, depth + 1);
        });
      };
      walkIssueIds(data, 0);
    } catch {}
  }
  const checklistMeta = {};
  const checklistExtra = [];
  const verifyIssue = async (issue) => {
    if (!issue?.id || assignedIds.has(issue.id)) return;
    let row = issue;
    if (!row.subject || String(row.subject).startsWith('Задача #')) {
      try {
        const ir = await fetch('/issues/' + row.id + '.json', {
          headers: { Accept: 'application/json' },
          credentials: 'include',
        });
        if (ir.ok) {
          const full = (await ir.json()).issue;
          if (full) row = full;
        }
      } catch {}
    }
    if (!isActive(row)) return;
    try {
      const r = await fetch('/questionlist/' + row.id + '.json', {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!r.ok) return;
      const data = await r.json();
      const myItems = collectMyItems(data);
      if (!myItems.length) return;
      checklistExtra.push(row);
      checklistMeta[String(row.id)] = myItems;
    } catch {}
  };
  for (const issue of [...candidates.values()].slice(0, 50)) {
    await verifyIssue(issue);
  }
  return { ok: true, issues: assigned.concat(checklistExtra), user, checklistMeta };
})()
`;
}

function extractAssignees(issue) {
  const people = [];
  const seen = new Set();
  const add = (person) => {
    if (!person?.id || seen.has(person.id)) return;
    seen.add(person.id);
    const name = (person.name || person.login || '').trim() || `User ${person.id}`;
    people.push({ id: person.id, name });
  };
  add(issue.assigned_to);
  if (issue.author?.id !== issue.assigned_to?.id) add(issue.author);
  if (Array.isArray(issue.watchers)) issue.watchers.forEach(add);
  return people;
}

function normalizeUpdatedOn(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString();
  } catch {
    return String(iso);
  }
}

export class MetaskService {
  constructor() {
    this.partition = 'persist:metask';
    this._sess = null;
    this.settings = {
      baseUrl: '',
      boardPath: '/kanban/board',
      username: '',
      password: '',
      apiKey: '',
    };
    this.loggedIn = false;
    this.lastError = null;
    this.userName = null;
    this.userId = null;
    /** @type {Map<number, string|null>} */
    this.avatarCache = new Map();
    /** @type {Map<number, { items: { id: number, title: string }[] }>} */
    this._checklistMetaByIssueId = new Map();
  }

  get sess() {
    if (!this._sess) {
      this._sess = session.fromPartition(this.partition);
    }
    return this._sess;
  }

  configure(settings = {}) {
    this.settings = {
      baseUrl: normalizeBaseUrl(settings.baseUrl),
      boardPath: settings.boardPath || '/kanban/board',
      username: settings.username || '',
      password: settings.password || '',
      apiKey: settings.apiKey || '',
    };
  }

  getBoardUrl() {
    const base = trimSlash(this.settings.baseUrl);
    if (!base) return '';
    const path = this.settings.boardPath || '/kanban/board';
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  getLoginUrl() {
    return `${this.settings.baseUrl}/login`;
  }

  async fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await this.sess.fetch(url, {
        redirect: 'follow',
        headers: { Accept: 'application/json', ...(options.headers || {}) },
        signal: controller.signal,
        ...options,
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* not json */
      }
      return { ok: res.ok, status: res.status, url: res.url, json, text };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { ok: false, status: 0, url, json: null, text: 'timeout' };
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  applyUserFromResponse(user) {
    if (!user) return;
    this.loggedIn = true;
    this.userId = user.id ?? this.userId;
    this.userName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.login;
  }

  async resolveCurrentUser() {
    const { baseUrl, apiKey } = this.settings;
    const keySuffix = apiKey?.trim()
      ? `?key=${encodeURIComponent(apiKey.trim())}`
      : '';
    const res = await this.fetchJson(`${baseUrl}/users/current.json${keySuffix}`);
    if (res.ok && res.json?.user) {
      this.applyUserFromResponse(res.json.user);
      return res.json.user;
    }
    this.loggedIn = false;
    this.userId = null;
    return null;
  }

  filterPersonalIssues(issues) {
    if (!this.userId || !Array.isArray(issues)) return issues || [];
    return issues.filter((issue) => issue.assigned_to?.id === this.userId);
  }

  async buildIssuesQueryParams(extra = {}) {
    await this.resolveCurrentUser();
    const { apiKey } = this.settings;
    const query = new URLSearchParams({
      status_id: 'open',
      limit: '100',
      offset: '0',
      sort: 'updated_on:desc',
      include: 'watchers',
      ...Object.fromEntries(
        Object.entries(extra).map(([key, value]) => [key, String(value)]),
      ),
    });
    if (!extra.assigned_to_id && !extra.issue_id) {
      query.set('assigned_to_id', String(this.userId || 'me'));
    }
    if (apiKey?.trim()) query.set('key', apiKey.trim());
    return query;
  }

  async buildIssuesQuery(offset = 0, limit = 100) {
    return this.buildIssuesQueryParams({
      assigned_to_id: String(this.userId || 'me'),
      offset: String(offset),
      limit: String(limit),
    });
  }

  async fetchIssuesWithParams(extra = {}, maxPages = 2) {
    const { baseUrl } = this.settings;
    const pageSize = 100;
    let offset = 0;
    let total = Infinity;
    const all = [];

    for (let page = 0; page < maxPages && offset < total; page += 1) {
      const query = await this.buildIssuesQueryParams({
        ...extra,
        offset: String(offset),
        limit: String(pageSize),
      });
      const res = await this.fetchJson(`${baseUrl}/issues.json?${query}`);
      if (!res.ok) break;
      const batch = res.json?.issues;
      if (!Array.isArray(batch) || !batch.length) break;
      all.push(...batch);
      total = res.json?.total_count ?? all.length;
      offset += batch.length;
      if (batch.length < pageSize) break;
    }

    return all;
  }

  async fetchAllAssignedIssues() {
    const { baseUrl } = this.settings;
    const pageSize = 100;
    let offset = 0;
    let total = Infinity;
    const all = [];

    while (offset < total) {
      const query = await this.buildIssuesQuery(offset, pageSize);
      const res = await this.fetchJson(`${baseUrl}/issues.json?${query}`);
      if (!res.ok && offset === 0) {
        this.lastError = `API ${res.status}: ${res.text?.slice(0, 120) || 'ошибка'}`;
        throw new Error(this.lastError);
      }
      const batch = res.json?.issues;
      if (!Array.isArray(batch) || !batch.length) break;
      all.push(...batch);
      total = res.json?.total_count ?? all.length;
      offset += batch.length;
      if (batch.length < pageSize) break;
    }

    return all;
  }

  async fetchIssuesByIds(ids = []) {
    const unique = [...new Set(ids.map((id) => Number(id)).filter(Boolean))];
    if (!unique.length) return [];

    const { baseUrl } = this.settings;
    const all = [];
    for (let i = 0; i < unique.length; i += 50) {
      const chunk = unique.slice(i, i + 50);
      const query = await this.buildIssuesQueryParams({
        issue_id: chunk.join(','),
        status_id: '*',
        limit: String(chunk.length),
        offset: '0',
      });
      query.delete('assigned_to_id');
      const res = await this.fetchJson(`${baseUrl}/issues.json?${query}`);
      if (!res.ok) continue;
      const batch = res.json?.issues;
      if (Array.isArray(batch)) all.push(...batch);
    }
    return all;
  }

  async resolveAttachmentIssueId(attachmentId) {
    const id = Number(attachmentId);
    const { baseUrl, apiKey } = this.settings;
    if (!id || !baseUrl?.trim()) return null;

    const qs = apiKey?.trim() ? `?key=${encodeURIComponent(apiKey.trim())}` : '';
    try {
      const res = await fetch(`${baseUrl}/attachments/${id}${qs}`, {
        headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; SHKF/1.0)' },
      });
      if (!res.ok) return null;
      const html = await res.text();
      const match = html.match(/\/issues\/(\d+)/);
      return match ? Number(match[1]) : null;
    } catch {
      return null;
    }
  }

  async searchIssuesForKnowledge(query, { limit = 40 } = {}) {
    const { baseUrl, apiKey } = this.settings;
    if (!baseUrl?.trim()) return [];

    const phrases = extractSearchPhrases(query);
    if (!phrases.length) return [];

    const seen = new Set();
    const hits = [];
    const maxTotal = Math.max(5, Math.min(60, Number(limit) || 40));

    for (const phrase of phrases.slice(0, 8)) {
      for (let offset = 0; offset < 100 && hits.length < maxTotal; offset += 25) {
        const qs = new URLSearchParams({
          q: phrase,
          issues: '1',
          attachments: '1',
          titles_only: '0',
          limit: '25',
          offset: String(offset),
        });
        if (apiKey?.trim()) qs.set('key', apiKey.trim());

        const res = await this.fetchJson(`${baseUrl}/search.json?${qs}`);
        if (!res.ok || !Array.isArray(res.json?.results)) break;

        const batch = res.json.results;
        if (!batch.length) break;

        for (const row of batch) {
          const type = String(row?.type || '').toLowerCase();
          if (type.includes('issue')) {
            const id = Number(row.id ?? row.issue_id ?? row.issue?.id);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            hits.push({
              score: 25 - hits.length * 0.2,
              issueId: id,
              subject: String(row.title || row.issue?.subject || '').trim(),
              snippet: String(row.description || row.issue?.description || '')
                .replace(/<[^>]+>/g, ' ').slice(0, 220),
              project: row.project_name || row.project?.name || '',
              status: row.status?.name || '',
              source: 'redmine-search',
            });
          } else if (type.includes('attachment') || type.includes('document')) {
            const attachmentId = Number(row.id);
            if (!attachmentId || seen.has(`att:${attachmentId}`)) continue;
            seen.add(`att:${attachmentId}`);
            const filename = String(row.title || row.filename || '').trim();
            hits.push({
              score: 32 - hits.length * 0.2,
              issueId: Number(row.issue_id ?? row.issue?.id ?? row.parent_id) || null,
              attachmentId,
              filename,
              subject: filename,
              snippet: String(row.description || '').replace(/<[^>]+>/g, ' ').slice(0, 180),
              project: row.project_name || '',
              status: '',
              source: 'redmine-attachment-search',
              attachmentHint: filename,
            });
          }
          if (hits.length >= maxTotal) break;
        }
        if (batch.length < 25) break;
      }
      if (hits.length >= maxTotal) break;
    }

    if (!hits.length) return [];

    const attachmentHits = hits.filter((h) => h.attachmentId && !h.issueId);
    if (attachmentHits.length) {
      await Promise.all(attachmentHits.map(async (hit) => {
        hit.issueId = await this.resolveAttachmentIssueId(hit.attachmentId);
      }));
    }
    const resolved = hits.filter((h) => h.issueId);

    try {
      const issues = await this.fetchIssuesByIds(resolved.map((h) => h.issueId));
      const mapped = this.mapIssues(issues);
      const byId = new Map(mapped.map((i) => [Number(i.id), i]));
      for (const hit of resolved) {
        const m = byId.get(Number(hit.issueId));
        if (!m) continue;
        if (!hit.subject || hit.source === 'redmine-attachment-search') {
          hit.subject = m.subject || hit.subject;
        }
        hit.project = m.project || hit.project;
        hit.status = m.status || hit.status;
        hit.url = m.url || '';
        hit.description = m.description || '';
      }
    } catch {
      /* partial */
    }

    return resolved.slice(0, maxTotal);
  }

  async fetchMyOpenChecklistItemsForIssue(issueId) {
    const id = Number(issueId);
    const uid = this.userId;
    if (!id || !uid) return [];

    const { baseUrl } = this.settings;
    const paths = [
      `/questionlist/${id}.json`,
      `/issues/${id}/checklists.json`,
      `/issues/${id}/checklist_items.json`,
    ];
    const { apiKey } = this.settings;
    const keyQs = apiKey?.trim() ? `?key=${encodeURIComponent(apiKey.trim())}` : '';

    for (const path of paths) {
      const res = await this.fetchJson(`${baseUrl}${path}${keyQs}`);
      if (!res.ok) continue;
      const items = parseMyOpenChecklistItems(res.json, uid);
      if (items.length) return items;
    }
    return [];
  }

  async fetchChecklistAssignedIssues(assignedIds = new Set()) {
    const uid = this.userId;
    if (!uid) return [];

    this._checklistMetaByIssueId = new Map();
    const candidates = new Map();
    const needFetchIds = new Set();

    const { baseUrl, apiKey } = this.settings;

    for (const path of CHECKLIST_ITEM_INDEX_PATHS) {
      const qs = new URLSearchParams({
        assigned_to_id: String(uid),
        limit: '100',
        is_done: '0',
      });
      if (apiKey?.trim()) qs.set('key', apiKey.trim());
      const res = await this.fetchJson(`${baseUrl}${path}?${qs}`);
      if (!res.ok) continue;

      const grouped = groupChecklistItemsByIssue(res.json, uid);
      for (const [issueId, items] of grouped) {
        if (assignedIds.has(issueId)) continue;
        this._checklistMetaByIssueId.set(issueId, { items });
        needFetchIds.add(issueId);
      }

      const orphanIds = extractIssueIdsFromChecklistIndex(res.json);
      for (const issueId of orphanIds) {
        if (assignedIds.has(issueId)) continue;
        needFetchIds.add(issueId);
      }
    }

    for (const key of CHECKLIST_ISSUE_FILTER_KEYS) {
      const batch = await this.fetchIssuesWithParams({ [key]: String(uid) }, 2);
      for (const issue of batch) {
        if (!issue?.id || assignedIds.has(issue.id)) continue;
        if (!isActiveNotImplementedIssue(issue)) continue;
        if (issue.assigned_to?.id === uid) continue;
        candidates.set(issue.id, issue);
      }
    }

    const verifyList = [...candidates.values()].slice(0, 60);
    const verified = [];
    await this.runPool(verifyList, async (issue) => {
      const items = await this.fetchMyOpenChecklistItemsForIssue(issue.id);
      if (!items.length) return;
      this._checklistMetaByIssueId.set(issue.id, { items });
      verified.push(issue);
    }, 5);

    if (needFetchIds.size) {
      const fetched = await this.fetchIssuesByIds([...needFetchIds]);
      for (const issue of fetched) {
        if (!issue?.id || assignedIds.has(issue.id)) continue;
        if (!isActiveNotImplementedIssue(issue)) continue;
        if (issue.assigned_to?.id === uid) continue;
        let items = this._checklistMetaByIssueId.get(issue.id)?.items;
        if (!items?.length) {
          items = await this.fetchMyOpenChecklistItemsForIssue(issue.id);
          if (!items.length) continue;
          this._checklistMetaByIssueId.set(issue.id, { items });
        }
        if (!verified.some((row) => row.id === issue.id)) verified.push(issue);
      }
    }

    const byId = new Map();
    for (const issue of verified) {
      if (issue?.id) byId.set(issue.id, issue);
    }
    return [...byId.values()];
  }

  async runPool(items, worker, concurrency = 5) {
    if (!items.length) return;
    let index = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const i = index;
        index += 1;
        await worker(items[i], i);
      }
    });
    await Promise.all(runners);
  }

  async buildRawPersonalIssues() {
    await this.resolveCurrentUser();
    const allAssigned = await this.fetchAllAssignedIssues();
    const assigned = allAssigned.filter(
      (issue) => issue.assigned_to?.id === this.userId && isActiveNotImplementedIssue(issue),
    );
    const assignedIds = new Set(assigned.map((issue) => issue.id));
    const checklistIssues = await this.fetchChecklistAssignedIssues(assignedIds);
    return mergePersonalIssueLists(assigned, checklistIssues, this._checklistMetaByIssueId);
  }

  async persistSessionCookies() {
    const baseUrl = this.settings.baseUrl;
    const cookies = await this.sess.cookies.get({ url: baseUrl });
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    for (const cookie of cookies) {
      if (!cookie.name || cookie.value == null) continue;
      try {
        await this.sess.cookies.set({
          url: baseUrl,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite || 'lax',
          expirationDate: expiry,
        });
      } catch {
        /* skip invalid cookie */
      }
    }
    try {
      await this.sess.cookies.flushStore();
    } catch {
      /* optional in some Electron builds */
    }
  }

  async hasStoredCookies() {
    const baseUrl = this.settings.baseUrl;
    const cookies = await this.sess.cookies.get({ url: baseUrl });
    return cookies.some((c) => c.name.includes('session') || c.name === '_redmine_session');
  }

  buildAutoLoginScript() {
    const { username, password } = this.settings;
    if (!username || !password) return null;
    return `(function() {
      if (!location.pathname.includes('login')) return { ok: false };
      var u = document.querySelector('#username, input[name="username"]');
      var p = document.querySelector('#password, input[name="password"]');
      var form = document.querySelector('form[action*="login"]');
      if (!u || !p || !form) return { ok: false };
      u.value = ${JSON.stringify(username)};
      p.value = ${JSON.stringify(password)};
      form.submit();
      return { ok: true };
    })()`;
  }

  mapIssues(issues) {
    const base = this.settings.baseUrl;
    const uid = this.userId;
    return issues.map((issue) => {
      const checklistItems = this._checklistMetaByIssueId?.get(issue.id)?.items || [];
      const isAssignee = uid && issue.assigned_to?.id === uid;
      const involvement = isAssignee ? 'assigned' : 'checklist';
      return {
        id: issue.id,
        subject: issue.subject,
        description: stripRedmineText(issue.description || ''),
        status: issue.status?.name || '—',
        priority: issue.priority?.name || '—',
        project: issue.project?.name || '',
        tracker: issue.tracker?.name || '',
        updatedOn: issue.updated_on || '',
        createdOn: issue.created_on || '',
        url: `${base}/issues/${issue.id}`,
        kanbanUrl: this.getBoardUrl(),
        assignees: extractAssignees(issue),
        involvement,
        checklistItems,
      };
    });
  }

  async addIssueComment(issueId, notes) {
    const id = Number(issueId);
    const text = String(notes || '').trim();
    if (!id || !text) {
      return { ok: false, message: 'Нет задачи или пустой комментарий' };
    }

    const { baseUrl, apiKey } = this.settings;
    if (!baseUrl?.trim()) {
      return { ok: false, message: 'Укажите URL Redmine в настройках Kanban' };
    }
    if (!apiKey?.trim()) {
      return { ok: false, message: 'Нужен API-ключ Redmine (Настройки → Kanban)' };
    }

    const qs = `?key=${encodeURIComponent(apiKey.trim())}`;
    const res = await this.fetchJson(`${baseUrl}/issues/${id}.json${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ issue: { notes: text } }),
    });

    if (!res.ok) {
      const errMsg = Array.isArray(res.json?.errors)
        ? res.json.errors.join('; ')
        : (res.text?.slice(0, 240) || `HTTP ${res.status}`);
      return { ok: false, message: errMsg };
    }

    return { ok: true, issueId: id };
  }

  async uploadIssueAttachment({ dataUrl, filename, contentType }) {
    const { baseUrl, apiKey } = this.settings;
    if (!baseUrl?.trim() || !apiKey?.trim()) {
      throw new Error('Нет настройки Redmine URL/API ключа');
    }

    const raw = String(dataUrl || '');
    const m = raw.match(/^data:([^;]+);base64,([\s\S]+)$/i);
    if (!m) throw new Error('Неверный формат изображения');
    const mime = (contentType || m[1] || 'image/png').trim().toLowerCase();
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) throw new Error('Пустое изображение');

    const safeName = String(filename || 'banner.png').replace(/[<>:"/\\|?*]+/g, '_');
    const qs = `?key=${encodeURIComponent(apiKey.trim())}&filename=${encodeURIComponent(safeName)}`;
    const res = await this.fetchJson(`${baseUrl}/uploads.json${qs}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        Accept: 'application/json',
      },
      body: buf,
    });
    if (!res.ok || !res.json?.upload?.token) {
      const errMsg = Array.isArray(res.json?.errors)
        ? res.json.errors.join('; ')
        : (res.text?.slice(0, 240) || `HTTP ${res.status}`);
      throw new Error(`Не удалось загрузить файл: ${errMsg}`);
    }

    return {
      token: res.json.upload.token,
      filename: safeName,
      content_type: mime,
    };
  }

  async addIssueCommentWithImages(issueId, notes, images = []) {
    const id = Number(issueId);
    const text = String(notes || '').trim();
    if (!id || !text) {
      return { ok: false, message: 'Нет задачи или пустой комментарий' };
    }

    const prepared = Array.isArray(images)
      ? images.filter((img) => String(img?.dataUrl || '').startsWith('data:image/')).slice(0, 12)
      : [];
    if (!prepared.length) {
      return this.addIssueComment(id, text);
    }

    const uploads = [];
    for (let i = 0; i < prepared.length; i++) {
      const img = prepared[i];
      try {
        const uploaded = await this.uploadIssueAttachment({
          dataUrl: img.dataUrl,
          filename: img.filename || `banner-${i + 1}.png`,
          contentType: img.contentType,
        });
        uploads.push(uploaded);
      } catch (err) {
        return { ok: false, message: err.message || 'Ошибка загрузки вложений' };
      }
    }

    const { baseUrl, apiKey } = this.settings;
    const qs = `?key=${encodeURIComponent(apiKey.trim())}`;
    const res = await this.fetchJson(`${baseUrl}/issues/${id}.json${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        issue: {
          notes: text,
          uploads,
        },
      }),
    });
    if (!res.ok) {
      const errMsg = Array.isArray(res.json?.errors)
        ? res.json.errors.join('; ')
        : (res.text?.slice(0, 240) || `HTTP ${res.status}`);
      return { ok: false, message: errMsg };
    }
    return { ok: true, issueId: id, uploads: uploads.length };
  }

  async fetchIssueRelations(issueId) {
    const id = Number(issueId);
    if (!id || !this.settings.baseUrl?.trim()) return [];
    const { baseUrl, apiKey } = this.settings;
    const qs = new URLSearchParams({ include: 'relations' });
    if (apiKey?.trim()) qs.set('key', apiKey.trim());
    const res = await this.fetchJson(`${baseUrl}/issues/${id}.json?${qs}`);
    if (!res.ok || !res.json?.issue) return [];
    return res.json.issue.relations || [];
  }

  /** Уже связаны ли две задачи (любым типом отношения). */
  async areIssuesLinked(fromId, toId) {
    const a = Number(fromId);
    const b = Number(toId);
    const relations = await this.fetchIssueRelations(a);
    return relations.some(
      (r) => (Number(r.issue_id) === b || Number(r.issue_to_id) === b),
    );
  }

  async createIssueRelation(fromId, toId, relationType = 'relates') {
    const from = Number(fromId);
    const to = Number(toId);
    if (!from || !to || from === to) {
      return { ok: false, message: 'Нужны две разные задачи' };
    }
    const { baseUrl, apiKey } = this.settings;
    if (!baseUrl?.trim()) {
      return { ok: false, message: 'Укажите URL Redmine в настройках Kanban' };
    }
    if (!apiKey?.trim()) {
      return { ok: false, message: 'Нужен API-ключ Redmine (Настройки → Kanban)' };
    }

    try {
      if (await this.areIssuesLinked(from, to)) {
        return { ok: true, alreadyLinked: true, fromId: from, toId: to };
      }
    } catch { /* проверку связи пропускаем при ошибке */ }

    const qs = `?key=${encodeURIComponent(apiKey.trim())}`;
    const res = await this.fetchJson(`${baseUrl}/issues/${from}/relations.json${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ relation: { issue_to_id: to, relation_type: relationType } }),
    });

    if (!res.ok) {
      const errMsg = Array.isArray(res.json?.errors)
        ? res.json.errors.join('; ')
        : (res.text?.slice(0, 240) || `HTTP ${res.status}`);
      return { ok: false, message: errMsg };
    }
    return { ok: true, fromId: from, toId: to, relation: res.json?.relation || null };
  }

  async addLaborLog(issueId, { hours, description } = {}) {
    const id = Number(issueId);
    const value = Number(hours);
    if (!id) {
      return { ok: false, message: 'Выберите задачу' };
    }
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, message: 'Укажите часы больше 0' };
    }

    const notes = formatLaborLogNotes(value, description);
    return this.addIssueComment(id, notes);
  }

  async fetchTimeEntriesForIssue(issueId) {
    const id = Number(issueId);
    if (!id || !this.settings.baseUrl?.trim()) return [];

    const { baseUrl, apiKey } = this.settings;
    const all = [];
    let offset = 0;
    const limit = 100;

    for (let page = 0; page < 20; page += 1) {
      const qs = new URLSearchParams({
        issue_id: String(id),
        limit: String(limit),
        offset: String(offset),
      });
      if (apiKey?.trim()) qs.set('key', apiKey.trim());

      const res = await this.fetchJson(`${baseUrl}/time_entries.json?${qs}`);
      if (!res.ok) break;

      const batch = res.json?.time_entries || [];
      all.push(...batch);

      const total = res.json?.total_count ?? all.length;
      offset += batch.length;
      if (!batch.length || offset >= total) break;
    }

    return mapTimeEntries(all);
  }

  async fetchIssueForAgent(issueId) {
    const id = Number(issueId);
    if (!id || !this.settings.baseUrl?.trim()) return null;

    const { baseUrl, apiKey } = this.settings;
    const qs = new URLSearchParams({ include: 'journals,attachments' });
    if (apiKey?.trim()) qs.set('key', apiKey.trim());

    const [res, laborTimeEntries] = await Promise.all([
      this.fetchJson(`${baseUrl}/issues/${id}.json?${qs}`),
      this.fetchTimeEntriesForIssue(id),
    ]);

    if (!res.ok || !res.json?.issue) return null;

    const issue = res.json.issue;
    const mapped = this.mapIssues([issue])[0];
    const attachments = (Array.isArray(issue.attachments) ? issue.attachments : [])
      .map((a) => ({
        id: Number(a?.id || 0) || null,
        filename: String(a?.filename || '').trim(),
        contentType: String(a?.content_type || '').trim(),
        contentUrl: this.withApiKey(this.normalizeAttachmentUrl(a?.content_url || '')),
        size: Number(a?.filesize || 0) || null,
        author: a?.author?.name || '',
        createdOn: a?.created_on || '',
        description: String(a?.description || '').trim(),
      }))
      .filter((a) => a.id && a.filename);

    const laborJournal = parseLaborFromJournals(issue.journals || []);
    const laborJournalIds = new Set(laborJournal.map((item) => item.journalId));

    const journalNotes = (issue.journals || [])
      .filter((j) => j.notes && String(j.notes).trim() && !laborJournalIds.has(j.id))
      .slice(-8)
      .map((j) => {
        const who = j.user?.name || 'Участник';
        const when = j.created_on || '';
        return `[${who}, ${when}]\n${stripRedmineText(j.notes)}`;
      })
      .join('\n\n');

    const customFields = (issue.custom_fields || [])
      .map((f) => ({ name: f.name, value: f.value }));

    const laborJournalEnriched = await this.enrichLaborEntries(laborJournal);
    const laborTimeEntriesEnriched = await this.enrichLaborEntries(laborTimeEntries);

    return {
      ...mapped,
      description: stripRedmineText(issue.description || mapped.description || ''),
      comments: journalNotes,
      customFields,
      doneRatio: issue.done_ratio,
      estimatedHours: issue.estimated_hours,
      laborJournal: laborJournalEnriched,
      laborTimeEntries: laborTimeEntriesEnriched,
      attachments,
    };
  }

  async enrichLaborEntries(entries = []) {
    if (!Array.isArray(entries) || !entries.length) return [];
    const ids = new Set(entries.map((e) => e.userId).filter(Boolean));
    await Promise.all([...ids].map((id) => this.fetchUserAvatar(id)));
    return entries.map((entry) => ({
      ...entry,
      avatarUrl: entry.userId ? this.avatarCache.get(entry.userId) || null : null,
    }));
  }

  withAvatarSize(url, size = 64) {
    if (!url || /size=/.test(url)) return url;
    return `${url}${url.includes('?') ? '&' : '?'}size=${size}`;
  }

  isPublicAvatarUrl(url) {
    return /gravatar\.com|secure\.gravatar|avatars\.githubusercontent|googleusercontent\.com/i.test(url);
  }

  async imageToDataUrl(url) {
    try {
      const res = await this.sess.fetch(url, { redirect: 'follow' });
      if (!res.ok) return null;
      const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
      if (!ct.startsWith('image/')) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 48) return null;
      return `data:${ct};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }

  async fetchUserAvatar(userId) {
    const id = Number(userId);
    if (!id) return null;
    if (this.avatarCache.has(id)) return this.avatarCache.get(id);

    const { baseUrl, apiKey } = this.settings;
    const qs = apiKey?.trim() ? `?key=${encodeURIComponent(apiKey.trim())}` : '';
    let result = null;

    const res = await this.fetchJson(`${baseUrl}/users/${id}.json${qs}`);
    const rawUrl = res.json?.user?.avatar_url?.trim() || '';

    if (rawUrl) {
      const absolute = rawUrl.startsWith('http')
        ? rawUrl
        : `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
      if (this.isPublicAvatarUrl(absolute)) {
        result = this.withAvatarSize(absolute);
      } else {
        result = await this.imageToDataUrl(absolute);
      }
    }

    if (!result) {
      result = await this.imageToDataUrl(`${baseUrl}/users/${id}/avatar`);
    }

    this.avatarCache.set(id, result);
    return result;
  }

  async enrichTasksAvatars(tasks) {
    if (!Array.isArray(tasks) || !tasks.length) return tasks || [];
    const ids = new Set();
    for (const task of tasks) {
      for (const person of task.assignees || []) {
        if (person?.id) ids.add(person.id);
      }
    }
    await Promise.all([...ids].map((id) => this.fetchUserAvatar(id)));
    return tasks.map((task) => ({
      ...task,
      assignees: (task.assignees || []).map((person) => ({
        ...person,
        avatarUrl: this.avatarCache.get(person.id) || null,
      })),
    }));
  }

  getSnapshotPath() {
    return path.join(app.getPath('userData'), 'metask-snapshot.json');
  }

  loadSnapshot() {
    try {
      const p = this.getSnapshotPath();
      if (!existsSync(p)) return {};
      return JSON.parse(readFileSync(p, 'utf-8'));
    } catch {
      return {};
    }
  }

  saveSnapshot(map) {
    try {
      writeFileSync(this.getSnapshotPath(), JSON.stringify(map, null, 2), 'utf-8');
    } catch {
      /* ignore */
    }
  }

  detectUpdates(tasks) {
    const prev = this.loadSnapshot();
    const hadPrev = Object.keys(prev).length > 0;
    const next = {};
    const updates = [];

    for (const task of tasks || []) {
      const key = String(task.id);
      const nextUpdated = normalizeUpdatedOn(task.updatedOn);
      next[key] = nextUpdated;
      if (hadPrev && prev[key] && prev[key] !== nextUpdated) {
        updates.push(task);
      }
    }

    this.saveSnapshot(next);
    return updates;
  }

  getCommentSnapshotPath() {
    return path.join(app.getPath('userData'), 'metask-comment-snapshot.json');
  }

  loadCommentSnapshot() {
    try {
      const p = this.getCommentSnapshotPath();
      if (!existsSync(p)) return {};
      return JSON.parse(readFileSync(p, 'utf-8'));
    } catch {
      return {};
    }
  }

  saveCommentSnapshot(map) {
    try {
      writeFileSync(this.getCommentSnapshotPath(), JSON.stringify(map, null, 2), 'utf-8');
    } catch {
      /* ignore */
    }
  }

  normalizeAttachmentUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = this.settings.baseUrl || '';
    return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }

  withApiKey(url) {
    const raw = String(url || '').trim();
    const key = String(this.settings.apiKey || '').trim();
    if (!raw || !key) return raw;
    if (/\bkey=/.test(raw)) return raw;
    return `${raw}${raw.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`;
  }

  pickJournalImageAttachments(issue, journal, hasAttachmentDetail = false) {
    if (!hasAttachmentDetail) return [];
    const all = Array.isArray(issue?.attachments) ? issue.attachments : [];
    const images = all.filter((a) => /^image\//i.test(String(a?.content_type || '')));
    if (!images.length) return [];

    const journalTs = new Date(journal?.created_on || 0).getTime() || 0;
    const authorId = Number(journal?.user?.id || 0);

    const close = images.filter((a) => {
      const ts = new Date(a?.created_on || 0).getTime() || 0;
      const near = journalTs && ts ? Math.abs(ts - journalTs) <= 30 * 60 * 1000 : false;
      const sameAuthor = authorId && Number(a?.author?.id || 0) === authorId;
      return near || sameAuthor;
    });
    return close
      .slice(0, 2)
      .map((a) => this.withApiKey(this.normalizeAttachmentUrl(a?.content_url || '')))
      .filter(Boolean);
  }

  async fetchIssueCommentUpdates(issueId, sinceJournalId = 0) {
    const id = Number(issueId);
    if (!id || !this.settings.baseUrl?.trim()) {
      return { lastJournalId: sinceJournalId, events: [] };
    }
    const { baseUrl, apiKey } = this.settings;
    const qs = new URLSearchParams({ include: 'journals,attachments' });
    if (apiKey?.trim()) qs.set('key', apiKey.trim());
    const res = await this.fetchJson(`${baseUrl}/issues/${id}.json?${qs}`);
    if (!res.ok || !res.json?.issue) {
      return { lastJournalId: sinceJournalId, events: [] };
    }

    const issue = res.json.issue;
    const issueUrl = `${baseUrl}/issues/${id}`;
    const journals = Array.isArray(issue.journals) ? issue.journals : [];
    let lastJournalId = Number(sinceJournalId) || 0;
    const events = [];

    for (const j of journals) {
      const jid = Number(j?.id || 0);
      if (!jid) continue;
      if (jid > lastJournalId) lastJournalId = jid;
      if (jid <= (Number(sinceJournalId) || 0)) continue;

      const rawNotes = String(j?.notes || '').trim();
      const notes = (stripRedmineText(rawNotes) || rawNotes).trim();
      const detailHasAttachment = Array.isArray(j?.details)
        && j.details.some((d) => String(d?.property || '').toLowerCase() === 'attachment'
          || /attachment/i.test(String(d?.name || d?.prop_key || d?.property || '')));
      if (!notes && !detailHasAttachment) continue;

      const userId = Number(j?.user?.id || 0) || null;
      let avatarUrl = null;
      if (userId) {
        try {
          avatarUrl = await this.fetchUserAvatar(userId);
        } catch {
          avatarUrl = null;
        }
      }
      const imageUrls = this.pickJournalImageAttachments(issue, j, detailHasAttachment);
      events.push({
        key: `${id}:${jid}`,
        issueId: id,
        issueUrl,
        issueSubject: issue.subject || '',
        journalId: jid,
        createdOn: normalizeIso(j?.created_on || ''),
        text: notes || 'Добавил вложение к задаче',
        user: {
          id: userId,
          name: String(j?.user?.name || 'Участник').trim() || 'Участник',
          avatarUrl: avatarUrl || null,
        },
        images: imageUrls,
      });
    }

    return { lastJournalId, events };
  }

  async detectCommentUpdates(tasks = []) {
    const prev = this.loadCommentSnapshot();
    const hadPrev = Object.keys(prev).length > 0;
    const next = { ...prev };
    const events = [];

    const targets = (Array.isArray(tasks) ? tasks : []).filter((t) => t?.id);
    await this.runPool(targets, async (task) => {
      const key = String(task.id);
      const since = Number(prev[key] || 0);
      const result = await this.fetchIssueCommentUpdates(task.id, since);
      if (result.lastJournalId) next[key] = result.lastJournalId;
      if (hadPrev && Array.isArray(result.events) && result.events.length) {
        events.push(...result.events);
      }
    }, 5);

    this.saveCommentSnapshot(next);
    events.sort((a, b) => new Date(a.createdOn || 0).getTime() - new Date(b.createdOn || 0).getTime());
    return events;
  }

  async fetchTasksViaApiKey() {
    const { apiKey } = this.settings;
    if (!apiKey?.trim()) return null;

    try {
      const issues = await this.buildRawPersonalIssues();
      this.loggedIn = true;
      return this.mapIssues(issues);
    } catch {
      this.lastError = 'Не удалось загрузить задачи';
      return null;
    }
  }

  async fetchTasksFromSession() {
    const user = await this.resolveCurrentUser();
    if (!user) return null;

    try {
      const issues = await this.buildRawPersonalIssues();
      return this.mapIssues(issues);
    } catch {
      return null;
    }
  }

  async fetchTasksFromWebContents(webContents) {
    if (!webContents || webContents.isDestroyed()) return null;
    const url = webContents.getURL();
    if (!url || url === 'about:blank' || url.includes('/login')) return null;

    try {
      if (!this.userId) await this.resolveCurrentUser();
      const script = buildTasksFetchScript(this.userId);
      const payload = await webContents.executeJavaScript(script, true);
      if (!payload?.ok) return null;
      return this.applyBrowserPayload(payload);
    } catch {
      return null;
    }
  }

  applyBrowserPayload(payload) {
    if (!payload?.ok) return null;
    if (payload.user) {
      this.loggedIn = true;
      this.userName = payload.user;
    }
    if (Array.isArray(payload.issues)) {
      this._checklistMetaByIssueId = new Map();
      const uid = this.userId;
      const active = payload.issues.filter((issue) => isActiveNotImplementedIssue(issue));
      if (payload.checklistMeta && typeof payload.checklistMeta === 'object') {
        for (const issue of active) {
          if (uid && issue.assigned_to?.id === uid) continue;
          const raw = payload.checklistMeta[String(issue.id)];
          if (!Array.isArray(raw) || !raw.length) continue;
          const items = raw
            .map((row, index) => ({
              id: index + 1,
              title: String(row?.title || row || '').trim(),
            }))
            .filter((row) => row.title);
          if (items.length) this._checklistMetaByIssueId.set(issue.id, { items });
        }
      }
      return this.mapIssues(active);
    }
    return null;
  }

  async fetchTasks(webContents = null) {
    const viaKey = await this.fetchTasksViaApiKey();
    if (viaKey !== null) return { ok: true, tasks: viaKey };

    if (webContents) {
      const viaBrowser = await this.fetchTasksFromWebContents(webContents);
      if (viaBrowser !== null) return { ok: true, tasks: viaBrowser };
    }

    const viaSession = await this.fetchTasksFromSession();
    if (viaSession !== null) return { ok: true, tasks: viaSession };

    return { ok: false, tasks: [] };
  }

  async sync(settings, webContents = null) {
    this.configure(settings);
    const { ok, tasks: rawTasks } = await this.fetchTasks(webContents);
    const tasks = ok ? await this.enrichTasksAvatars(rawTasks) : [];
    const updates = ok ? this.detectUpdates(tasks) : [];
    return {
      ok: true,
      fetchOk: ok,
      loggedIn: this.loggedIn,
      user: this.userName,
      boardUrl: this.getBoardUrl(),
      loginUrl: this.getLoginUrl(),
      tasks,
      updates,
      hasStoredCookies: await this.hasStoredCookies(),
      lastError: ok ? this.lastError : (this.lastError || 'Не удалось загрузить задачи'),
    };
  }

  getSessionPartition() {
    return this.partition;
  }
}
