/** Guards Redmine write IPC — only explicit user gestures allowed. */

export const METASK_WRITE_CHANNELS = new Set([
  'metask-add-comment',
  'metask-add-labor-log',
  'agent-post-mockups-to-task',
  'agent-link-tasks',
]);

export function assertMetaskUserGesture(payload, channel = '') {
  if (payload?.userGesture !== true) {
    const ch = channel ? ` (${channel})` : '';
    return {
      ok: false,
      message: `Запись в Redmine заблокирована${ch}: нужно явное действие пользователя (кнопка + подтверждение).`,
      blocked: true,
    };
  }
  return null;
}

export function withUserGesture(payload = {}) {
  return { ...payload, userGesture: true };
}
