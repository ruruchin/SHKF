/** @typedef {{ id: number, title: string, issueId?: number }} ChecklistItemRef */

export function isActiveNotImplementedIssue(issue) {
  if (issue?.status?.is_closed === true) return false;
  const name = (issue?.status?.name || '').toLowerCase();
  if (/внедр|implement|deployed|release|released/.test(name)) return false;
  if (/закры|closed|resolved|решен|принят|accepted|выполн|done|отклон|reject|cancel|отмен|archived|archive/.test(name)) {
    return false;
  }
  return true;
}

/** Redmine Advanced Checklists — possible issue-list filter keys (varies by install). */
export const CHECKLIST_ISSUE_FILTER_KEYS = [
  'checklist_element_assigned_id',
  'checklist_assigned_to_id',
  'checklist_assignee_id',
  'element_assigned_id',
  'advanced_checklist_assigned_to_id',
];

export const CHECKLIST_ITEM_INDEX_PATHS = [
  '/checklist_items.json',
  '/checklists.json',
  '/questions.json',
  '/advanced_checklist_items.json',
];

/**
 * Collect open checklist items assigned to userId from a plugin JSON payload.
 * @param {unknown} json
 * @param {number} userId
 * @returns {ChecklistItemRef[]}
 */
export function parseMyOpenChecklistItems(json, userId) {
  const uid = Number(userId);
  if (!uid || !json) return [];
  const items = [];
  const seen = new Set();

  const consider = (node) => {
    if (!node || typeof node !== 'object') return;
    const assigned =
      node.assigned_to_id ??
      node.assigned_to?.id ??
      node.assignee_id ??
      node.user_id;
    const title = node.title ?? node.subject ?? node.name;
    const id = node.id ?? node.question_id;
    const issueId = node.issue_id ?? node.issue?.id ?? node.issueId;
    if (!id || !title || assigned == null) return;

    const done =
      node.done === true ||
      node.is_done === true ||
      node.is_done === 1 ||
      node.completed === true ||
      node.state === 'done';

    if (Number(assigned) !== uid || done) return;
    const key = String(id);
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      id: Number(id),
      title: String(title).trim(),
      ...(issueId ? { issueId: Number(issueId) } : {}),
    });
  };

  const walk = (node, depth = 0) => {
    if (!node || depth > 12) return;
    if (Array.isArray(node)) {
      node.forEach((child) => walk(child, depth + 1));
      return;
    }
    if (typeof node !== 'object') return;

    consider(node);

    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') walk(value, depth + 1);
    }
  };

  walk(json);
  return items;
}

/**
 * @param {unknown} json
 * @returns {number[]}
 */
export function extractIssueIdsFromChecklistIndex(json) {
  const ids = new Set();
  const arrays = [
    json?.checklist_items,
    json?.checklists,
    json?.questions,
    json?.items,
    json?.data?.items,
    json?.data?.questions,
  ];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      const issueId = row?.issue_id ?? row?.issue?.id ?? row?.issueId;
      if (issueId) ids.add(Number(issueId));
    }
  }
  return [...ids];
}

/**
 * @param {unknown} json
 * @param {number} userId
 * @returns {Map<number, ChecklistItemRef[]>}
 */
export function groupChecklistItemsByIssue(json, userId) {
  const byIssue = new Map();
  for (const item of parseMyOpenChecklistItems(json, userId)) {
    if (!item.issueId) continue;
    if (!byIssue.has(item.issueId)) byIssue.set(item.issueId, []);
    byIssue.get(item.issueId).push(item);
  }
  return byIssue;
}

/**
 * @param {object[]} assignedIssues
 * @param {object[]} checklistIssues
 * @param {Map<number, { items: ChecklistItemRef[] }>} checklistMeta
 */
export function mergePersonalIssueLists(assignedIssues, checklistIssues, checklistMeta) {
  const byId = new Map();
  for (const issue of assignedIssues || []) {
    if (!issue?.id) continue;
    byId.set(issue.id, issue);
  }
  for (const issue of checklistIssues || []) {
    if (!issue?.id || byId.has(issue.id)) continue;
    byId.set(issue.id, issue);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.updated_on || 0).getTime() - new Date(a.updated_on || 0).getTime(),
  );
}
