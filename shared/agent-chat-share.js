const MAX_SHARED_MESSAGES = 80;
const MAX_MESSAGE_CHARS = 12000;
const MAX_TITLE_CHARS = 120;

export function sanitizeMessagesForShare(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m?.role === 'user' || m?.role === 'assistant')
    .slice(-MAX_SHARED_MESSAGES)
    .map((m) => {
      let content = String(m.content || '').slice(0, MAX_MESSAGE_CHARS);
      if (Array.isArray(m.images) && m.images.length && !/\[изображение\]/i.test(content)) {
        content = content ? `${content}\n[изображение]` : '[изображение]';
      }
      return {
        role: m.role,
        content,
        taskThread: !!m.taskThread,
      };
    })
    .filter((m) => m.content.trim());
}

export function buildSharedChatPayload(session = {}) {
  const messages = sanitizeMessagesForShare(session.messages);
  return {
    title: String(session.title || 'Чат').slice(0, MAX_TITLE_CHARS),
    taskId: session.taskId || null,
    messageCount: messages.length,
    messages,
  };
}

export function konstanciaShareMarker(shareId) {
  const id = String(shareId || '').trim();
  return id ? `[konstancia-share:${id}]` : '';
}

export const KONSTANCIA_SHARE_MARKER_RE = /\[konstancia-share:([0-9a-f-]{36})\]/gi;

export function formatKonstanciaSharePingMessage({ ownerName = '', title = '', shareId = '' } = {}) {
  const from = String(ownerName || 'Коллега').trim();
  const chatTitle = String(title || 'Чат').trim();
  const marker = konstanciaShareMarker(shareId);
  const lines = [
    `📨 ${from} поделился чатом Konstancia «${chatTitle}».`,
    'Откройте Konstancia — чат появится в списке слева.',
  ];
  if (marker) lines.push(marker);
  return lines.join('\n');
}

/** Текст ping-сообщения от отправителя (в его личке — от «Вы»). */
export function formatKonstanciaSharePingMessageFromSender({ title = '', shareId = '' } = {}) {
  const chatTitle = String(title || 'Чат').trim();
  const marker = konstanciaShareMarker(shareId);
  const lines = [
    `📨 Поделился чатом Konstancia «${chatTitle}».`,
    'У коллеги чат появится в Konstancia автоматически.',
  ];
  if (marker) lines.push(marker);
  return lines.join('\n');
}

export function formatColleagueLabel(profile = {}) {
  const name = String(profile.full_name || '').trim();
  const username = String(profile.username || '').trim();
  const position = String(profile.position || '').trim();
  if (name && username) return position ? `${name} (@${username}) · ${position}` : `${name} (@${username})`;
  if (name) return position ? `${name} · ${position}` : name;
  if (username) return `@${username}`;
  return String(profile.email || 'Коллега').split('@')[0] || 'Коллега';
}

export function buildImportedShareTitle(share = {}) {
  const payload = share?.payload && typeof share.payload === 'object' ? share.payload : {};
  const title = String(payload.title || share.title || 'Чат').trim();
  return title.length > MAX_TITLE_CHARS ? `${title.slice(0, MAX_TITLE_CHARS - 1)}…` : title;
}
