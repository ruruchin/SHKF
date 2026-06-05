/**
 * Read-only facade over MetaskService for learning / analytics pipelines.
 * Write methods are intentionally not exposed.
 */

const READ_METHODS = [
  'configure',
  'sync',
  'fetchIssueForAgent',
  'fetchTimeEntriesForIssue',
  'fetchIssueRelations',
  'areIssuesLinked',
  'detectUpdates',
  'detectCommentUpdates',
  'mapIssues',
  'getBoardUrl',
  'getSessionPartition',
  'loadSnapshot',
  'saveSnapshot',
  'loadCommentSnapshot',
  'saveCommentSnapshot',
];

export function createMetaskReadOnly(metaskService) {
  if (!metaskService) {
    throw new Error('MetaskReadOnly: metaskService required');
  }
  const proxy = {};
  for (const name of READ_METHODS) {
    const fn = metaskService[name];
    if (typeof fn === 'function') {
      proxy[name] = (...args) => fn.apply(metaskService, args);
    }
  }
  proxy.configure = (...args) => metaskService.configure(...args);
  proxy.getSettings = () => ({ ...(metaskService.settings || {}) });
  proxy.getUserId = () => metaskService.userId ?? null;
  proxy.getUserName = () => metaskService.userName || '';
  return proxy;
}

export function assertNoMetaskWrite(methodName) {
  const forbidden = /^(add|create|upload|post|put|delete)/i;
  if (forbidden.test(String(methodName || ''))) {
    throw new Error(`TaskKnowledge: forbidden Redmine write method "${methodName}"`);
  }
}
