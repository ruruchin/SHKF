/** Team chat helpers: task refs, mentions, payload limits. */

export const TEAM_CHAT_GENERAL_ROOM_ID = '00000000-0000-4000-8000-000000000001';
export const TEAM_CHAT_MAX_BODY = 8000;
export const TEAM_CHAT_MAX_ATTACHMENTS = 6;
export const TEAM_CHAT_MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export function normalizeDmPair(userA, userB) {
  const a = String(userA || '').trim();
  const b = String(userB || '').trim();
  if (!a || !b || a === b) return null;
  return a < b ? { dmLow: a, dmHigh: b } : { dmLow: b, dmHigh: a };
}

export function parseTaskRefs(text) {
  const ids = new Set();
  const raw = String(text || '');
  const re = /(?:^|[\s(,])#(\d{1,8})(?=[\s,.!?;:)]|$)/g;
  let match = re.exec(` ${raw} `);
  while (match) {
    const id = Number(match[1]);
    if (id > 0) ids.add(id);
    match = re.exec(` ${raw} `);
  }
  return [...ids];
}

export function parseMentionUsernames(text) {
  const names = new Set();
  const raw = String(text || '');
  const re = /@([a-z0-9._-]{2,32})/gi;
  let match = re.exec(raw);
  while (match) {
    names.add(String(match[1] || '').toLowerCase());
    match = re.exec(raw);
  }
  return [...names];
}

export function resolveMentionIds(text, colleagues = []) {
  const wanted = new Set(parseMentionUsernames(text));
  if (!wanted.size) return [];
  const ids = [];
  for (const profile of colleagues) {
    const username = String(profile?.username || '').trim().toLowerCase();
    if (username && wanted.has(username)) ids.push(String(profile.id));
  }
  return ids;
}

export function sanitizeAttachments(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice(0, TEAM_CHAT_MAX_ATTACHMENTS)
    .map((item) => ({
      id: String(item?.id || '').trim(),
      name: String(item?.name || 'файл').trim().slice(0, 180),
      url: String(item?.url || '').trim(),
      path: String(item?.path || '').trim(),
      mime: String(item?.mime || '').trim().slice(0, 120),
      size: Math.max(0, Number(item?.size) || 0),
    }))
    .filter((item) => item.url || item.path);
}

export function filterColleagues(query, colleagues = []) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return colleagues;
  return colleagues.filter((profile) => {
    const hay = [
      profile.full_name,
      profile.username,
      profile.position,
      profile.email,
      profile.role,
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function sanitizeMessageBody(text) {
  return String(text || '').trim().slice(0, TEAM_CHAT_MAX_BODY);
}

export function buildDmTitle(profile = {}) {
  const name = String(profile.full_name || '').trim();
  const username = String(profile.username || '').trim();
  if (name) return name;
  if (username) return `@${username}`;
  return 'Личные сообщения';
}

export function buildTaskRoomTitle(taskId, subject = '') {
  const id = Number(taskId);
  const title = String(subject || '').trim();
  if (title) return `#${id} · ${title.slice(0, 72)}`;
  return `Задача #${id}`;
}

export function formatTeamChatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function colleagueInitials(profile = {}) {
  const name = String(profile.full_name || profile.username || '?').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function buildForwardMeta(sourceMessage = {}, authorName = '') {
  const meta = sourceMessage?.meta && typeof sourceMessage.meta === 'object' ? sourceMessage.meta : {};
  const existing = meta.forward && typeof meta.forward === 'object' ? meta.forward : null;
  const authorId = String(existing?.author_id || sourceMessage.author_id || '').trim();
  const name = String(existing?.author_name || authorName || '').trim();
  if (!authorId && !name) return null;
  return {
    forward: {
      author_id: authorId,
      author_name: name.slice(0, 120),
      from_message_id: String(sourceMessage.id || '').trim(),
      from_room_id: String(sourceMessage.room_id || '').trim(),
      forwarded_at: new Date().toISOString(),
    },
  };
}

export function forwardAuthorLabel(message = {}) {
  const meta = message?.meta && typeof message.meta === 'object' ? message.meta : {};
  const forward = meta.forward && typeof meta.forward === 'object' ? meta.forward : null;
  if (!forward) return '';
  const name = String(forward.author_name || '').trim();
  if (name) return name;
  const author = message.author || {};
  return String(author.full_name || author.username || 'Коллега').trim();
}

export function isForwardedMessage(message = {}) {
  const meta = message?.meta && typeof message.meta === 'object' ? message.meta : {};
  return !!(meta.forward && typeof meta.forward === 'object' && (meta.forward.author_id || meta.forward.author_name));
}
