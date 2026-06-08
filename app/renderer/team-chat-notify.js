/**
 * Team chat notifications — badge + pill when someone writes while you're elsewhere.
 */
(function initTeamChatNotify() {
  const POLL_MS = 8000;
  let pollTimer = null;
  let baselineReady = false;
  const lastMessageAt = new Map();

  function allRooms(result = {}) {
    return [...(result.rooms || []), ...(result.dmRooms || [])];
  }

  function roomLabel(room = {}) {
    if (room.kind === 'general') return 'Общий';
    if (room.kind === 'dm') {
      const peer = room.peer || {};
      return String(peer.full_name || peer.username || 'Личные сообщения').trim();
    }
    return String(room.title || 'Команда').trim();
  }

  function previewText(message = {}) {
    const body = String(message.body || '').trim();
    if (body) return body.slice(0, 140);
    return 'Вложение';
  }

  function shouldNotify(roomId, message, meId) {
    if (!message?.created_at) return false;
    if (String(message.author_id || '') === String(meId || '')) return false;

    const onTeamChat = window.isTeamChatPageActive?.();
    const currentRoomId = String(window.getCurrentTeamChatRoomId?.() || '');
    if (onTeamChat && currentRoomId === String(roomId || '')) return false;

    const prev = lastMessageAt.get(roomId);
    if (!prev) return false;
    return String(message.created_at) !== String(prev);
  }

  function captureBaseline(result) {
    for (const room of allRooms(result)) {
      lastMessageAt.set(room.id, room.lastMessage?.created_at || null);
    }
    baselineReady = true;
  }

  function pulseTeamChatNav() {
    const nav = document.querySelector('.nav-item[data-page="teamchat"]');
    if (!nav) return;
    nav.classList.remove('has-teamchat-alert');
    void nav.offsetWidth;
    nav.classList.add('has-teamchat-alert');
    window.setTimeout(() => nav.classList.remove('has-teamchat-alert'), 1600);
  }

  function notifyRoom(room, message) {
    const title = roomLabel(room);
    const body = previewText(message);
    const action = {
      type: 'teamchat-open-room',
      roomId: room.id,
      colleagueId: room.peer?.id || null,
    };

    pulseTeamChatNav();

    window.api.showPillNotify?.({
      title,
      body,
      subtitle: body,
      badge: 'Команда',
      tag: 'Новое сообщение',
      icon: 'spark',
      durationMs: 14000,
      action,
    });

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const note = new Notification(`Команда · ${title}`, {
          body,
          silent: false,
        });
        note.onclick = () => {
          window.openTeamChatRoom?.(room.id, { colleagueId: room.peer?.id || null });
        };
      } catch {
        /* ignore */
      }
    }
  }

  function processDirectorySnapshot(result) {
    if (!result?.ok) return;

    window.SidebarRail?.updateTeamChatBadge?.(result.unreadTeam || 0);

    if (!baselineReady) {
      captureBaseline(result);
      return;
    }

    for (const room of allRooms(result)) {
      const message = room.lastMessage;
      if (!shouldNotify(room.id, message, result.meId)) {
        lastMessageAt.set(room.id, message?.created_at || null);
        continue;
      }
      notifyRoom(room, message);
      lastMessageAt.set(room.id, message?.created_at || null);
    }
  }

  async function pollDirectory() {
    const auth = window.getAuthState?.();
    if (!auth?.user?.id) return;
    if (window.isTeamChatPageActive?.()) return;

    const result = await window.api.teamChatDirectory?.({ previews: true });
    processDirectorySnapshot(result);
  }

  function startPolling() {
    stopPolling();
    baselineReady = false;
    lastMessageAt.clear();
    void pollDirectory();
    pollTimer = window.setInterval(() => {
      void pollDirectory();
    }, POLL_MS);
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
    baselineReady = false;
    lastMessageAt.clear();
  }

  function initTeamChatNotify() {
    window.onTeamChatDirectorySnapshot = processDirectorySnapshot;

    window.addEventListener('auth-session-changed', (event) => {
      if (event.detail?.user?.id) startPolling();
      else stopPolling();
    });

    if (window.getAuthState?.()?.user?.id) startPolling();

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {});
    }
  }

  window.initTeamChatNotify = initTeamChatNotify;
})();
