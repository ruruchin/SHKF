(function initTeamChat() {
  const GENERAL_ROOM_ID = '00000000-0000-4000-8000-000000000001';
  const MESSAGES_POLL_MS = 4000;
  const DIRECTORY_POLL_MS = 8000;
  const DIRECTORY_CACHE_KEY = 'shkf-teamchat-directory-v2';
  const MESSAGES_CACHE_KEY = 'shkf-teamchat-messages-v1';
  const MESSAGES_FETCH_TIMEOUT_MS = 30000;
  const $ = (id) => document.getElementById(id);

  let inited = false;
  let active = false;
  let messagesPollTimer = null;
  let directoryPollTimer = null;
  let rooms = [];
  let colleagues = [];
  let peopleQuery = '';
  let meId = null;
  let meProfile = null;
  let currentRoomId = GENERAL_ROOM_ID;
  let messages = [];
  let pinnedMessages = [];
  let pendingAttachments = [];
  let sending = false;
  let directoryLoading = false;
  let directoryPreviewsLoaded = false;
  let messagesLoadSeq = 0;
  let messagesLoadingRoomId = null;
  let contextMessageId = null;
  let forwardMessageId = null;
  let forwardSelectedColleagueId = null;
  let forwardQuery = '';
  let forwardDmPrewarm = null;
  const messageCache = new Map();
  const roomStates = new Map();
  const messagesInflight = new Map();
  const attachmentDisplayUrl = new Map();
  const TEAMCHAT_BRAND_LOGO = 'assets/brand/logo.png';

  function isImageAttachment(file = {}) {
    const mime = String(file.mime || '');
    if (/^image\//i.test(mime)) return true;
    const name = String(file.name || file.path || '').toLowerCase();
    return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(name);
  }

  function rememberAttachmentUrls(attachments = []) {
    for (const file of attachments) {
      const path = String(file?.path || '').trim();
      const url = String(file?.url || '').trim();
      if (path && url) attachmentDisplayUrl.set(path, url);
    }
  }

  function resolveAttachmentDisplayUrl(file = {}) {
    const path = String(file.path || '').trim();
    const url = String(file.url || '').trim();
    if (path && url) attachmentDisplayUrl.set(path, url);
    if (path && attachmentDisplayUrl.has(path)) return attachmentDisplayUrl.get(path);
    return url;
  }

  function attachmentFingerprint(attachments = []) {
    return (Array.isArray(attachments) ? attachments : [])
      .map((file) => String(file.path || file.name || '').trim())
      .filter(Boolean)
      .join(',');
  }

  function mergeAttachmentLists(serverList = [], localList = []) {
    const localByPath = new Map();
    for (const file of localList) {
      const path = String(file?.path || '').trim();
      if (path) localByPath.set(path, file);
    }
    return (Array.isArray(serverList) ? serverList : []).map((file) => {
      const path = String(file?.path || '').trim();
      const local = path ? localByPath.get(path) : null;
      const url = resolveAttachmentDisplayUrl(file)
        || resolveAttachmentDisplayUrl(local || {})
        || String(file?.url || local?.url || '').trim();
      return { ...file, url };
    });
  }

  function enrichMessageAttachments(message = {}) {
    const attachments = mergeAttachmentLists(message.attachments, message.attachments);
    rememberAttachmentUrls(attachments);
    return { ...message, attachments };
  }

  function buildMessagesRenderKey(items = []) {
    return items.map((message) => {
      const attachments = (message.attachments || [])
        .map((file) => {
          const path = file.path || '';
          const ready = resolveAttachmentDisplayUrl(file) ? '1' : '0';
          return `${path}:${file.name || ''}:${file.mime || ''}:${ready}`;
        })
        .join(',');
      return [
        message.id,
        message.pending ? 'p' : '',
        message.pinned ? 'pin' : '',
        message.body || '',
        attachments,
      ].join('|');
    }).join(';;');
  }

  function patchMessageAttachmentImages() {
    const list = $('teamchat-messages');
    if (!list) return;
    list.querySelectorAll('.teamchat-attachment img[data-attach-path]').forEach((img) => {
      const path = String(img.getAttribute('data-attach-path') || '').trim();
      const nextUrl = path ? attachmentDisplayUrl.get(path) : '';
      if (nextUrl && img.getAttribute('src') !== nextUrl) {
        img.setAttribute('src', nextUrl);
      }
    });
  }

  function invalidateMessagesLoads() {
    messagesLoadSeq += 1;
  }

  function isStaleMessagesLoad(seq, roomId) {
    return seq !== messagesLoadSeq || String(roomId || '') !== String(currentRoomId || '');
  }

  function withTimeout(promise, ms, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(message || 'Таймаут запроса')), ms);
      }),
    ]);
  }

  function readMessagesCache(roomId) {
    if (!roomId || !meId) return null;
    try {
      const raw = localStorage.getItem(MESSAGES_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.meId !== meId) return null;
      const entry = parsed.rooms?.[roomId];
      if (!entry?.messages?.length) return null;
      return entry;
    } catch {
      return null;
    }
  }

  function writeMessagesCache(roomId, payload) {
    if (!roomId || !meId || !payload?.messages?.length) return;
    try {
      const raw = localStorage.getItem(MESSAGES_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : { meId, rooms: {} };
      if (parsed.meId !== meId) {
        parsed.meId = meId;
        parsed.rooms = {};
      }
      parsed.rooms[roomId] = {
        messages: payload.messages,
        pinned: payload.pinned || [],
        at: Date.now(),
      };
      const roomIds = Object.keys(parsed.rooms);
      if (roomIds.length > 24) {
        roomIds
          .sort((a, b) => (parsed.rooms[b]?.at || 0) - (parsed.rooms[a]?.at || 0))
          .slice(24)
          .forEach((id) => delete parsed.rooms[id]);
      }
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      /* ignore quota */
    }
  }

  function hydrateRoomMessagesCache(roomId) {
    if (messageCache.has(roomId)) return messageCache.get(roomId);
    const cached = readMessagesCache(roomId);
    if (!cached) return null;
    messageCache.set(roomId, cached);
    return cached;
  }

  function profileDisplaySeed(profile = {}) {
    return String(profile.id || profile.username || profile.full_name || profile.email || 'user').trim();
  }

  function defaultAvatarUrl(profile = {}) {
    const seed = encodeURIComponent(profileDisplaySeed(profile));
    return `https://api.dicebear.com/9.x/thumbs/png?seed=${seed}&size=96&backgroundColor=6e56cf,13a36e,e85d3b,ecc94b`;
  }

  function resolveAvatarUrl(profile = {}, { general = false } = {}) {
    if (general) return TEAMCHAT_BRAND_LOGO;
    const url = String(profile?.avatar_url || '').trim();
    if (url) return url;
    return defaultAvatarUrl(profile);
  }

  function contactAvatarInner(profile = {}, { general = false } = {}) {
    const url = resolveAvatarUrl(profile, { general });
    if (url) return `<img src="${escapeHtml(url)}" alt="" />`;
    return escapeHtml(colleagueInitials(profile));
  }

  function messagesForRoom(list, roomId) {
    const id = String(roomId || '').trim();
    if (!id) return [];
    return (Array.isArray(list) ? list : []).filter((item) => String(item.room_id || '') === id);
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
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

  function colleagueShortName(profile = {}) {
    const name = String(profile.full_name || '').trim();
    const username = String(profile.username || '').trim();
    const emailLogin = String(profile.email || '').split('@')[0]?.trim();
    if (name) return name;
    if (username) return `@${username}`;
    if (emailLogin) return emailLogin;
    return 'Коллега';
  }

  function colleagueSubtitle(profile = {}) {
    const position = String(profile.position || '').trim();
    if (position) return position;
    const role = String(profile.role || '').trim();
    return role || 'Сотрудник SHKF';
  }

  function renderContactAvatar(content, { channel = false } = {}) {
    const cls = channel ? 'teamchat-contact-avatar is-channel' : 'teamchat-contact-avatar';
    return `<span class="${cls}">${content}</span>`;
  }

  function renderAvatarHtml(profile = {}, { channel = false, general = false } = {}) {
    const cls = channel ? 'teamchat-msg-avatar is-channel' : 'teamchat-msg-avatar';
    const url = resolveAvatarUrl(profile, { general });
    if (url) {
      return `<span class="${cls}"><img src="${escapeHtml(url)}" alt="" /></span>`;
    }
    const label = profile.icon || colleagueInitials(profile);
    return `<span class="${cls}">${escapeHtml(label)}</span>`;
  }

  function messageAuthorProfile(message) {
    const author = message.author || {};
    if (message.author_id === meId && meProfile) {
      return { ...meProfile, id: meId };
    }
    return author;
  }

  function getRoomState(roomId) {
    const id = String(roomId || '').trim();
    if (!id) return { messages: [], pinned: [] };
    if (roomStates.has(id)) return roomStates.get(id);
    const cached = messageCache.get(id) || hydrateRoomMessagesCache(id);
    if (cached) {
      const state = {
        messages: [...(cached.messages || [])],
        pinned: [...(cached.pinned || [])],
      };
      roomStates.set(id, state);
      return state;
    }
    return { messages: [], pinned: [] };
  }

  function setRoomState(roomId, nextMessages, nextPinned) {
    const id = String(roomId || '').trim();
    if (!id) return;
    const state = {
      messages: [...(nextMessages || [])],
      pinned: [...(nextPinned || [])],
    };
    roomStates.set(id, state);
    messageCache.set(id, { ...state, at: Date.now() });
    writeMessagesCache(id, state);
  }

  function syncCurrentView() {
    const state = getRoomState(currentRoomId);
    messages = state.messages;
    pinnedMessages = state.pinned;
  }

  function findDmRoomForColleague(colleagueId) {
    const peerId = String(colleagueId || '').trim();
    if (!peerId || peerId === meId) return null;
    return rooms.find((room) => {
      if (room.kind !== 'dm') return false;
      if (room.peer?.id === peerId) return true;
      return room.dm_low === peerId || room.dm_high === peerId;
    }) || null;
  }

  function syncColleagueDmRooms() {
    colleagues = colleagues.map((profile) => {
      const room = findDmRoomForColleague(profile.id);
      return {
        ...profile,
        dmRoomId: room?.id || null,
      };
    });
  }

  function mergeMessagesFromServer(roomId, serverMessages, existingMessages, { replace = false } = {}) {
    const id = String(roomId || '').trim();
    const server = (Array.isArray(serverMessages) ? serverMessages : [])
      .map((item) => ({ ...item, room_id: item.room_id || id }))
      .filter((item) => String(item.room_id || '') === id);
    const serverIds = new Set(server.map((item) => item.id));
    const local = messagesForRoom(existingMessages, id);

    const localPending = local.filter((item) => {
      if (!item.pending && !String(item.id).startsWith('temp-')) return false;
      if (serverIds.has(item.id)) return false;
      const matched = server.some((row) => (
        row.author_id === item.author_id
        && row.body === item.body
        && attachmentFingerprint(row.attachments) === attachmentFingerprint(item.attachments)
        && Math.abs(new Date(row.created_at).getTime() - new Date(item.created_at).getTime()) < 20000
      ));
      return !matched;
    });

    const mergedById = new Map();
    if (replace) {
      for (const item of server) {
        const pendingMatch = localPending.find((row) => (
          row.author_id === item.author_id
          && row.body === item.body
          && attachmentFingerprint(row.attachments) === attachmentFingerprint(item.attachments)
          && Math.abs(new Date(row.created_at).getTime() - new Date(item.created_at).getTime()) < 20000
        ));
        const merged = pendingMatch
          ? enrichMessageAttachments({
            ...item,
            attachments: mergeAttachmentLists(item.attachments, pendingMatch.attachments),
          })
          : enrichMessageAttachments(item);
        mergedById.set(item.id, merged);
      }
    } else {
      for (const item of local) {
        if (item.pending || String(item.id).startsWith('temp-')) continue;
        mergedById.set(item.id, item);
      }
      for (const item of server) mergedById.set(item.id, enrichMessageAttachments(item));
    }
    for (const item of localPending) {
      if (!mergedById.has(item.id)) mergedById.set(item.id, enrichMessageAttachments(item));
    }

    const merged = [...mergedById.values()];
    merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return merged;
  }

  function messagePreviewText(message = null) {
    if (!message) return 'Нет сообщений';
    const body = String(message.body || '').trim();
    if (body) return body.slice(0, 72);
    return 'Вложение';
  }

  async function loadMeProfile() {
    const auth = window.getAuthState?.();
    if (auth?.profile) {
      meProfile = auth.profile;
      return;
    }
    const result = await window.api.authGetProfile?.();
    if (result?.ok && result.profile) {
      meProfile = result.profile;
      return;
    }
    const session = await window.api.authGetSession?.();
    if (session?.profile) meProfile = session.profile;
  }

  function readDirectoryCache(userId) {
    if (!userId) return null;
    try {
      const raw = localStorage.getItem(DIRECTORY_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.meId !== userId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeDirectoryCache(payload) {
    if (!payload?.ok || !payload.meId) return;
    try {
      localStorage.setItem(DIRECTORY_CACHE_KEY, JSON.stringify({
        meId: payload.meId,
        colleagues: payload.colleagues || [],
        rooms: payload.rooms || [],
        dmRooms: payload.dmRooms || [],
        unreadTeam: payload.unreadTeam || 0,
        savedAt: Date.now(),
      }));
    } catch {
      /* ignore quota */
    }
  }

  function applyDirectoryResult(result, { fromCache = false } = {}) {
    if (!result?.ok) return false;
    colleagues = result.colleagues || [];
    rooms = [...(result.rooms || []), ...(result.dmRooms || [])];
    meId = result.meId || meId;
    syncColleagueDmRooms();
    window.SidebarRail?.updateTeamChatBadge?.(result.unreadTeam || 0);
    window.onTeamChatDirectorySnapshot?.(result);
    if (!currentRoomId) {
      const general = rooms.find((room) => room.kind === 'general');
      currentRoomId = general?.id || GENERAL_ROOM_ID;
    }
    renderRooms();
    renderColleagues();
    renderHeader();
    if (!fromCache) writeDirectoryCache(result);
    return true;
  }

  function hydrateFromDirectoryCache(userId) {
    const cached = readDirectoryCache(userId);
    if (!cached) return false;
    return applyDirectoryResult({
      ok: true,
      meId: cached.meId,
      colleagues: cached.colleagues,
      rooms: cached.rooms,
      dmRooms: cached.dmRooms,
      unreadTeam: cached.unreadTeam,
    }, { fromCache: true });
  }

  function renderProfileAvatar(room) {
    const el = $('teamchat-profile-avatar');
    if (!el) return;

    if (!room) {
      el.className = 'teamchat-profile-avatar is-channel';
      el.innerHTML = `<img src="${escapeHtml(TEAMCHAT_BRAND_LOGO)}" alt="" />`;
      return;
    }

    if (room.kind === 'general') {
      el.className = 'teamchat-profile-avatar is-channel';
      el.innerHTML = `<img src="${escapeHtml(TEAMCHAT_BRAND_LOGO)}" alt="" />`;
      return;
    }

    if (room.kind === 'task') {
      el.className = 'teamchat-profile-avatar is-channel';
      el.textContent = `#${room.task_id || 'T'}`;
      return;
    }

    if (room.kind === 'dm' && room.peer) {
      el.className = 'teamchat-profile-avatar';
      const url = resolveAvatarUrl(room.peer);
      if (url) {
        el.innerHTML = `<img src="${escapeHtml(url)}" alt="" />`;
      } else {
        el.textContent = colleagueInitials(room.peer);
      }
      return;
    }

    el.className = 'teamchat-profile-avatar is-channel';
    el.textContent = colleagueInitials({ full_name: roomTitle(room) });
  }

  function colleagueInitials(profile = {}) {
    const name = String(
      profile.full_name || profile.username || profile.email?.split('@')[0] || '?',
    ).trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function colleagueLabel(profile = {}) {
    const name = String(profile.full_name || '').trim();
    const username = String(profile.username || '').trim();
    if (name && username) return `${name} (@${username})`;
    if (name) return name;
    if (username) return `@${username}`;
    return 'Коллега';
  }

  function formatMessageTime(iso) {
    const value = formatTime(iso);
    return value ? value.replace(/\./g, '').toUpperCase() : '';
  }

  function filterPeople(list, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((profile) => {
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

  function renderMessageBody(text) {
    let html = escapeHtml(String(text || ''));
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/@([a-z0-9._-]{2,32})/gi, '<span class="teamchat-mention">@$1</span>');
    html = html.replace(/#(\d{1,8})/g, '<button type="button" class="teamchat-task-link" data-teamchat-task="$1">#$1</button>');
    html = html.replace(
      /\[konstancia-share:([0-9a-f-]{36})\]/gi,
      (_, shareId) => `<button type="button" class="teamchat-konstancia-link" data-konstancia-share="${shareId}">Открыть в Konstancia</button>`,
    );
    return html;
  }

  function findMessageById(messageId) {
    const id = String(messageId || '').trim();
    if (!id) return null;
    return messages.find((item) => item.id === id) || null;
  }

  function isForwardedMessage(message) {
    const meta = message?.meta && typeof message.meta === 'object' ? message.meta : {};
    const forward = meta.forward && typeof meta.forward === 'object' ? meta.forward : null;
    return !!(forward && (forward.author_id || forward.author_name));
  }

  function forwardAuthorLabel(message) {
    const meta = message?.meta && typeof message.meta === 'object' ? message.meta : {};
    const forward = meta.forward && typeof meta.forward === 'object' ? meta.forward : null;
    const fromForward = String(forward?.author_name || '').trim();
    if (fromForward) return fromForward;
    const author = messageAuthorProfile(message);
    return colleagueShortName(author);
  }

  function renderForwardBadge(message) {
    if (!isForwardedMessage(message)) return '';
    const name = forwardAuthorLabel(message);
    return `<div class="teamchat-msg-forward">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H9a4 4 0 0 0-4 4v7"/></svg>
      <span>Переслано от <strong>${escapeHtml(name)}</strong></span>
    </div>`;
  }

  const CONTEXT_ICON = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    forward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H9a4 4 0 0 0-4 4v7"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 17v5"/><path d="M9 3h6l1 7h4l-5 6 1 5H8l1-5-5-6h4z"/></svg>',
  };

  function hideContextMenu() {
    contextMessageId = null;
    const menu = $('teamchat-context-menu');
    if (!menu) return;
    menu.classList.add('hidden');
    menu.innerHTML = '';
    menu.setAttribute('aria-hidden', 'true');
  }

  function placeContextMenu(menu, x, y) {
    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.classList.remove('hidden');
    const rect = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function showContextMenu(x, y, messageId) {
    const message = findMessageById(messageId);
    if (!message) return;

    const menu = $('teamchat-context-menu');
    if (!menu) return;

    contextMessageId = messageId;
    const pinLabel = message.pinned ? 'Открепить' : 'Закрепить';
    const hasText = String(message.body || '').trim().length > 0;

    menu.innerHTML = `
      ${hasText ? `<button type="button" class="teamchat-context-item" data-context-action="copy">${CONTEXT_ICON.copy}<span>Копировать текст</span></button>` : ''}
      <button type="button" class="teamchat-context-item" data-context-action="forward">${CONTEXT_ICON.forward}<span>Переслать</span></button>
      <div class="teamchat-context-sep" role="separator"></div>
      <button type="button" class="teamchat-context-item" data-context-action="pin">${CONTEXT_ICON.pin}<span>${pinLabel}</span></button>
    `;
    menu.setAttribute('aria-hidden', 'false');
    placeContextMenu(menu, x, y);
  }

  async function copyMessageText(messageId) {
    const message = findMessageById(messageId);
    const text = String(message?.body || '').trim();
    if (!text) {
      setStatus('Нечего копировать');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Текст скопирован');
      window.setTimeout(() => setStatus(''), 1800);
    } catch {
      setStatus('Не удалось скопировать');
    }
  }

  function closeForwardModal() {
    forwardMessageId = null;
    forwardSelectedColleagueId = null;
    forwardQuery = '';
    forwardDmPrewarm = null;
    $('teamchat-forward-overlay')?.classList.add('hidden');
    $('teamchat-forward-overlay')?.setAttribute('aria-hidden', 'true');
    const search = $('teamchat-forward-search');
    if (search) search.value = '';
    const submit = $('teamchat-forward-submit');
    if (submit) submit.disabled = true;
  }

  function renderForwardColleagues() {
    const listEl = $('teamchat-forward-list');
    if (!listEl) return;

    const available = filterPeople(
      colleagues.filter((profile) => profile.id && profile.id !== meId),
      forwardQuery,
    );

    if (!available.length) {
      listEl.innerHTML = '<p class="teamchat-forward-empty">Коллеги не найдены</p>';
      return;
    }

    listEl.innerHTML = available.map((profile) => {
      const selected = profile.id === forwardSelectedColleagueId;
      const avatarUrl = resolveAvatarUrl(profile);
      const avatarInner = avatarUrl
        ? `<img src="${escapeHtml(avatarUrl)}" alt="" />`
        : escapeHtml(colleagueInitials(profile));
      return `<button type="button" class="teamchat-forward-item${selected ? ' is-selected' : ''}" data-forward-colleague="${escapeHtml(profile.id)}">
        <span class="teamchat-forward-item-avatar">${avatarInner}</span>
        <span class="teamchat-forward-item-copy">
          <span class="teamchat-forward-item-name">${escapeHtml(colleagueShortName(profile))}</span>
          <span class="teamchat-forward-item-sub">${escapeHtml(colleagueSubtitle(profile))}</span>
        </span>
      </button>`;
    }).join('');
  }

  function prewarmForwardDm(recipientId) {
    const id = String(recipientId || '').trim();
    if (!id || id === meId) return;
    forwardDmPrewarm = window.api.teamChatOpenDm?.({ recipientId: id }).catch(() => null);
  }

  function openForwardModal(messageId) {
    const message = findMessageById(messageId);
    if (!message) return;

    forwardMessageId = messageId;
    forwardSelectedColleagueId = null;
    forwardQuery = '';

    const preview = $('teamchat-forward-preview');
    if (preview) {
      const snippet = String(message.body || 'Вложение').replace(/\s+/g, ' ').trim().slice(0, 160);
      const from = isForwardedMessage(message) ? forwardAuthorLabel(message) : colleagueShortName(messageAuthorProfile(message));
      preview.textContent = `От ${from}: ${snippet}${String(message.body || '').length > 160 ? '…' : ''}`;
    }

    const overlay = $('teamchat-forward-overlay');
    overlay?.classList.remove('hidden');
    overlay?.setAttribute('aria-hidden', 'false');
    renderForwardColleagues();
    $('teamchat-forward-search')?.focus();
  }

  async function submitForward() {
    if (!forwardMessageId || !forwardSelectedColleagueId) return;
    const messageId = forwardMessageId;
    const recipientId = forwardSelectedColleagueId;
    const submit = $('teamchat-forward-submit');
    if (submit) submit.disabled = true;
    setStatus('Пересылаем…');

    const result = await window.api.teamChatForwardMessage?.({
      messageId,
      recipientId,
    });

    if (!result?.ok) {
      setStatus(result?.message || 'Не удалось переслать');
      if (submit) submit.disabled = false;
      return;
    }

    closeForwardModal();
    setStatus('Сообщение переслано');
    window.setTimeout(() => setStatus(''), 1500);

    if (result.roomId && result.message) {
      ingestSharePingMessage(result.roomId, result.message, recipientId, { skipReload: true });
      await selectRoom(result.roomId, { silentMessages: true });
      void loadDirectory({ silent: true, previews: true });
    } else if (result.roomId) {
      await selectRoom(result.roomId, { silentMessages: true });
    }
  }

  function onContextMenuClick(event) {
    const btn = event.target.closest('[data-context-action]');
    if (!btn || !contextMessageId) return;
    event.stopPropagation();
    const action = btn.getAttribute('data-context-action');
    const messageId = contextMessageId;
    hideContextMenu();

    if (action === 'copy') {
      void copyMessageText(messageId);
      return;
    }
    if (action === 'forward') {
      openForwardModal(messageId);
      return;
    }
    if (action === 'pin') {
      void togglePinMessage(messageId);
    }
  }

  function onMessageContextMenu(event) {
    const article = event.target.closest('.teamchat-msg[data-message-id]');
    if (!article || article.classList.contains('pending')) return;
    event.preventDefault();
    event.stopPropagation();
    showContextMenu(event.clientX, event.clientY, article.getAttribute('data-message-id'));
  }

  function setStatus(text) {
    const el = $('teamchat-status-text');
    if (el) el.textContent = text || '';
  }

  function showAuthGate(message) {
    $('teamchat-auth')?.classList.remove('hidden');
    $('teamchat-workspace')?.classList.add('hidden');
    const textEl = $('teamchat-auth-text');
    if (textEl) textEl.textContent = message || 'Войдите в SHKF, чтобы писать коллегам.';
  }

  function isNetworkIssueMessage(message) {
    return /supabase|недоступен|timeout|таймаут|network|fetch failed|интернет|offline/i.test(String(message || ''));
  }

  function showWorkspace() {
    $('teamchat-auth')?.classList.add('hidden');
    $('teamchat-workspace')?.classList.remove('hidden');
    if (!currentRoomId) currentRoomId = GENERAL_ROOM_ID;
    renderHeader();
  }

  function ingestSharePingMessage(roomId, message, recipientId, { skipReload = false } = {}) {
    const id = String(roomId || '').trim();
    if (!id || !message?.id) return;

    const state = getRoomState(id);
    const merged = mergeMessagesFromServer(id, [{ ...message, room_id: message.room_id || id }], state.messages, { replace: false });
    setRoomState(id, merged, state.pinned);

    const peerId = String(recipientId || '').trim();
    if (peerId && !findDmRoomForColleague(peerId)) {
      const peer = colleagues.find((item) => item.id === peerId) || null;
      if (peer) {
        rooms = [...rooms, {
          id,
          kind: 'dm',
          peer,
          title: colleagueShortName(peer),
          dm_low: meId && peerId ? [meId, peerId].sort()[0] : undefined,
          dm_high: meId && peerId ? [meId, peerId].sort()[1] : undefined,
        }];
        renderRooms();
        renderColleagues();
      }
    }

    if (id === String(currentRoomId || '')) {
      syncCurrentView();
      renderMessages();
    }

    patchCurrentRoomPreview(message.body || 'Konstancia · чат', id);
    void loadDirectory({ silent: true, previews: true });
    if (!skipReload && active) void loadMessages({ silent: true, roomId: id });
  }

  function patchCurrentRoomPreview(body, roomId = currentRoomId) {
    const id = String(roomId || '').trim();
    if (!id) return;
    const room = rooms.find((item) => item.id === id);
    if (!room) return;
    const preview = { body: String(body || '').slice(0, 200), created_at: new Date().toISOString() };
    room.lastMessage = preview;
    room.unread = 0;
    if (room.kind === 'dm' && room.peer?.id) {
      const colleague = colleagues.find((profile) => profile.id === room.peer.id);
      if (colleague) {
        colleague.lastMessage = preview;
        colleague.unread = 0;
      }
    }
    renderRooms();
    renderColleagues();
  }

  function currentRoom() {
    const room = rooms.find((item) => item.id === currentRoomId);
    if (!room) return null;
    if (room.kind === 'dm' && !room.peer) {
      const peer = colleagues.find((item) => item.id === room.dm_low || item.id === room.dm_high || item.dmRoomId === room.id);
      if (peer) return { ...room, peer, title: colleagueShortName(peer) };
    }
    return room;
  }

  function roomTitle(room) {
    if (!room) return 'Чат';
    if (room.kind === 'general') return room.title || 'Общий';
    if (room.kind === 'task') return room.title || `Задача #${room.task_id}`;
    return room.title || 'Личные сообщения';
  }

  function renderRooms() {
    const list = $('teamchat-rooms');
    if (!list) return;

    if (directoryLoading && !rooms.length) {
      list.innerHTML = '<div class="teamchat-empty teamchat-loading">Загрузка каналов…</div>';
      return;
    }

    const channelRooms = rooms.filter((room) => room.kind !== 'dm');
    if (!channelRooms.length) {
      list.innerHTML = '<div class="teamchat-empty">Нет каналов</div>';
      return;
    }

    list.innerHTML = channelRooms.map((room) => {
      const activeCls = room.id === currentRoomId ? ' active' : '';
      const unreadCls = room.unread > 0 ? ' has-unread' : '';
      const preview = messagePreviewText(room.lastMessage);
      const badge = room.unread > 0 ? '<span class="teamchat-room-badge" aria-label="Непрочитано"></span>' : '';
      const pin = room.pinned ? '<span class="teamchat-room-pin" aria-hidden="true">📌</span>' : '';
      const isGeneral = room.kind === 'general';
      let avatarInner;
      if (isGeneral) {
        avatarInner = contactAvatarInner({}, { general: true });
      } else if (room.kind === 'task') {
        avatarInner = escapeHtml(`#${room.task_id || 'T'}`);
      } else {
        avatarInner = contactAvatarInner({});
      }
      const avatar = renderContactAvatar(avatarInner, { channel: true });
      return `<button type="button" class="teamchat-room-btn${activeCls}${unreadCls}" data-room-id="${room.id}">
        ${avatar}
        <span class="teamchat-room-body">
          <span class="teamchat-room-title">${pin}${escapeHtml(roomTitle(room))}</span>
          <span class="teamchat-room-preview">${escapeHtml(preview)}</span>
        </span>
        ${badge}
      </button>`;
    }).join('');

    list.querySelectorAll('[data-room-id]').forEach((btn) => {
      btn.addEventListener('click', () => selectRoom(btn.getAttribute('data-room-id')));
    });
  }

  function renderColleagues() {
    const list = $('teamchat-colleagues');
    const countEl = $('teamchat-people-count');
    if (!list) return;

    const filtered = filterPeople(colleagues, peopleQuery);
    if (countEl) countEl.textContent = String(filtered.length);

    if (directoryLoading && !colleagues.length) {
      list.innerHTML = '<div class="teamchat-empty teamchat-loading" style="padding:12px">Загрузка сотрудников…</div>';
      return;
    }

    if (!colleagues.length) {
      list.innerHTML = '<div class="teamchat-empty" style="padding:12px">Нет сотрудников в базе</div>';
      return;
    }
    if (!filtered.length) {
      list.innerHTML = '<div class="teamchat-empty" style="padding:12px">Никого не найдено</div>';
      return;
    }

    list.innerHTML = filtered.map((profile) => {
      const avatarInner = contactAvatarInner(profile);
      const avatar = renderContactAvatar(avatarInner);
      const preview = profile.lastMessage
        ? messagePreviewText(profile.lastMessage).slice(0, 56)
        : 'Написать сообщение';
      const isActive = profile.dmRoomId && profile.dmRoomId === currentRoomId;
      const unreadCls = profile.unread > 0 ? ' has-unread' : '';
      const badge = profile.unread > 0 ? '<span class="teamchat-room-badge" aria-label="Непрочитано"></span>' : '';
      const pin = profile.pinned ? '<span class="teamchat-room-pin" aria-hidden="true">📌</span>' : '';
      return `<button type="button" class="teamchat-colleague-btn${isActive ? ' active' : ''}${unreadCls}" data-colleague-id="${profile.id}" data-dm-room="${profile.dmRoomId || ''}">
        ${avatar}
        <span class="teamchat-colleague-body">
          <span class="teamchat-colleague-name">${pin}${escapeHtml(colleagueShortName(profile))}</span>
          <span class="teamchat-colleague-preview">${escapeHtml(colleagueSubtitle(profile))} · ${escapeHtml(preview)}</span>
        </span>
        ${badge}
      </button>`;
    }).join('');

    list.querySelectorAll('[data-colleague-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const colleagueId = btn.getAttribute('data-colleague-id');
        const resolved = findDmRoomForColleague(colleagueId);
        if (resolved?.id) {
          await selectRoom(resolved.id);
          return;
        }
        await openDm(colleagueId);
      });
    });
  }

  function syncPinRoomButton() {
    const btn = $('teamchat-pin-room');
    const room = currentRoom();
    if (!btn) return;
    if (!room) {
      btn.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden');
    btn.classList.toggle('is-active', !!room.pinned);
    btn.title = room.pinned ? 'Открепить чат' : 'Закрепить чат';
    btn.setAttribute('aria-label', btn.title);
  }

  function renderHeader() {
    const room = currentRoom();
    const titleEl = $('teamchat-main-title');
    const subEl = $('teamchat-main-sub');
    renderProfileAvatar(room);
    if (titleEl) titleEl.textContent = roomTitle(room);
    if (!subEl) {
      syncPinRoomButton();
      return;
    }
    if (!room) {
      subEl.textContent = '';
      syncPinRoomButton();
      return;
    }
    if (room.kind === 'general') {
      subEl.textContent = 'Общий канал команды SHKF · #123 для задач · @логин для упоминаний';
    } else if (room.kind === 'task') {
      subEl.textContent = `Обсуждение задачи #${room.task_id} · видят все участники SHKF`;
    } else if (room.kind === 'dm' && room.peer) {
      subEl.textContent = `${colleagueSubtitle(room.peer)} · личная переписка`;
    } else if (room.kind === 'dm') {
      subEl.textContent = 'Личная переписка · видят только вы двое';
    } else {
      subEl.textContent = '';
    }
    syncPinRoomButton();
  }

  function renderPinnedBar() {
    const bar = $('teamchat-pinned-bar');
    if (!bar) return;
    if (!pinnedMessages.length) {
      bar.classList.add('hidden');
      bar.innerHTML = '';
      return;
    }
    bar.classList.remove('hidden');
    bar.innerHTML = pinnedMessages.map((message) => {
      const preview = String(message.body || 'Вложение').replace(/\s+/g, ' ').slice(0, 120);
      return `<div class="teamchat-pinned-item" data-pinned-id="${message.id}">
        <span class="teamchat-pinned-label">📌</span>
        <button type="button" class="teamchat-pinned-text" data-jump-message="${message.id}">${escapeHtml(preview)}</button>
        <button type="button" class="teamchat-pinned-unpin" data-unpin-message="${message.id}" title="Открепить">×</button>
      </div>`;
    }).join('');

    bar.querySelectorAll('[data-jump-message]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const node = document.querySelector(`[data-message-id="${btn.getAttribute('data-jump-message')}"]`);
        node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    bar.querySelectorAll('[data-unpin-message]').forEach((btn) => {
      btn.addEventListener('click', () => togglePinMessage(btn.getAttribute('data-unpin-message'), true));
    });
  }

  function renderMessages() {
    const list = $('teamchat-messages');
    if (!list) return;

    renderPinnedBar();

    if (!currentRoomId) {
      list.innerHTML = '<div class="teamchat-empty">Выберите чат или сотрудника слева</div>';
      return;
    }

    if (messagesLoadingRoomId === currentRoomId && !messages.length) {
      list.innerHTML = '<div class="teamchat-empty teamchat-loading">Загрузка сообщений…</div>';
      return;
    }

    if (!messages.length) {
      list.innerHTML = '<div class="teamchat-empty">Пока нет сообщений — напишите первым</div>';
      return;
    }

    const visibleMessages = messagesForRoom(messages, currentRoomId);
    if (!visibleMessages.length) {
      list.innerHTML = '<div class="teamchat-empty">Пока нет сообщений — напишите первым</div>';
      list.dataset.renderKey = '';
      return;
    }

    const renderKey = buildMessagesRenderKey(visibleMessages);
    const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 96;
    if (list.dataset.renderKey === renderKey) {
      patchMessageAttachmentImages();
      return;
    }
    list.dataset.renderKey = renderKey;

    list.innerHTML = visibleMessages.map((message) => {
      const mine = message.author_id === meId;
      const author = messageAuthorProfile(message);
      const authorName = mine ? 'Вы' : colleagueShortName(author);
      const avatarHtml = renderAvatarHtml(author);
      const taskIds = Array.isArray(message.task_ids) ? message.task_ids : [];
      const extraTasks = taskIds
        .filter((id) => !String(message.body || '').includes(`#${id}`))
        .map((id) => `<button type="button" class="teamchat-task-link" data-teamchat-task="${id}">#${id}</button>`)
        .join('');
      const tasksHtml = extraTasks ? `<div class="teamchat-msg-tasks">${extraTasks}</div>` : '';

      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      const attachmentsHtml = attachments.length
        ? `<div class="teamchat-msg-attachments">${attachments.map((file) => {
          const displayUrl = resolveAttachmentDisplayUrl(file);
          if (isImageAttachment(file) && displayUrl) {
            const path = String(file.path || '').trim();
            const pathAttr = path ? ` data-attach-path="${escapeHtml(path)}"` : '';
            return `<a class="teamchat-attachment" href="${escapeHtml(displayUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(displayUrl)}" alt="${escapeHtml(file.name || 'image')}" loading="lazy" decoding="async"${pathAttr} /></a>`;
          }
          return `<a class="teamchat-attachment teamchat-attachment-file" href="${escapeHtml(displayUrl || '#')}" target="_blank" rel="noopener">${escapeHtml(file.name || 'Файл')}</a>`;
        }).join('')}</div>`
        : '';

      const pinTitle = message.pinned ? 'Открепить сообщение' : 'Закрепить сообщение';

      return `<article class="teamchat-msg${message.pinned ? ' is-pinned' : ''}${message.pending ? ' pending' : ''}" data-message-id="${message.id}">
        <div class="teamchat-msg-row">
          ${avatarHtml}
          <div class="teamchat-msg-content">
            <div class="teamchat-msg-head">
              <span class="teamchat-msg-author">${escapeHtml(authorName)}</span>
              <span class="teamchat-msg-time">${escapeHtml(formatMessageTime(message.created_at))}</span>
              <button type="button" class="teamchat-msg-pin" data-pin-message="${message.id}" title="${pinTitle}" aria-label="${pinTitle}">📌</button>
            </div>
            ${renderForwardBadge(message)}
            <div class="teamchat-msg-body">${renderMessageBody(message.body)}</div>
            ${tasksHtml}
            ${attachmentsHtml}
          </div>
        </div>
      </article>`;
    }).join('');

    list.querySelectorAll('[data-teamchat-task]').forEach((btn) => {
      btn.addEventListener('click', () => openTask(Number(btn.getAttribute('data-teamchat-task'))));
    });
    list.querySelectorAll('[data-pin-message]').forEach((btn) => {
      btn.addEventListener('click', () => togglePinMessage(btn.getAttribute('data-pin-message')));
    });
    list.querySelectorAll('[data-konstancia-share]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shareId = btn.getAttribute('data-konstancia-share');
        if (window.openKonstanciaShare?.(shareId)) return;
        setStatus('Не удалось открыть чат в Konstancia');
      });
    });

    if (wasNearBottom) list.scrollTop = list.scrollHeight;
    patchMessageAttachmentImages();
  }

  async function togglePinMessage(messageId, forceUnpin = false) {
    if (!currentRoomId || !messageId) return;
    const message = messages.find((m) => m.id === messageId);
    const shouldUnpin = forceUnpin || message?.pinned;
    const result = shouldUnpin
      ? await window.api.teamChatUnpinMessage?.({ roomId: currentRoomId, messageId })
      : await window.api.teamChatPinMessage?.({ roomId: currentRoomId, messageId });
    if (!result?.ok) {
      setStatus(result?.message || 'Не удалось изменить закреп');
      return;
    }
    await loadMessages();
  }

  async function togglePinRoom() {
    const room = currentRoom();
    if (!room?.id) return;
    const result = room.pinned
      ? await window.api.teamChatUnpinRoom?.({ roomId: room.id })
      : await window.api.teamChatPinRoom?.({ roomId: room.id });
    if (!result?.ok) {
      setStatus(result?.message || 'Не удалось закрепить чат');
      return;
    }
    await loadDirectory();
    renderHeader();
  }

  function renderPendingAttachments() {
    const wrap = $('teamchat-pending');
    if (!wrap) return;
    if (!pendingAttachments.length) {
      wrap.innerHTML = '';
      wrap.classList.add('hidden');
      return;
    }
    wrap.classList.remove('hidden');
    wrap.innerHTML = pendingAttachments.map((file, index) => {
      const preview = /^image\//i.test(file.mime) && file.url
        ? `<img src="${escapeHtml(file.url)}" alt="" />`
        : `<span class="teamchat-attachment-file">${escapeHtml(file.name || 'Файл')}</span>`;
      return `<div class="teamchat-pending-item">${preview}<button type="button" class="teamchat-pending-remove" data-remove-idx="${index}" aria-label="Убрать">×</button></div>`;
    }).join('');

    wrap.querySelectorAll('[data-remove-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        pendingAttachments.splice(Number(btn.getAttribute('data-remove-idx')), 1);
        renderPendingAttachments();
      });
    });
  }

  async function loadDirectory({ silent = false, previews = null, skipCache = false } = {}) {
    const usePreviews = previews !== null ? previews : directoryPreviewsLoaded;
    if (!rooms.length && !colleagues.length) {
      directoryLoading = true;
      renderRooms();
      renderColleagues();
    }

    const result = await window.api.teamChatDirectory?.({ previews: usePreviews, skipCache });
    directoryLoading = false;
    if (!result?.ok) {
      renderRooms();
      renderColleagues();
      return result;
    }

    applyDirectoryResult(result);
    if (usePreviews) directoryPreviewsLoaded = true;
    if (!silent) setStatus('');
    if (!usePreviews && result.ok) {
      void loadDirectory({ silent: true, previews: true });
    }
    return result;
  }

  async function loadMessages({ silent = false, roomId = null } = {}) {
    const targetRoomId = String(roomId || currentRoomId || '').trim();
    if (!targetRoomId) return;

    if (messagesInflight.has(targetRoomId)) {
      return messagesInflight.get(targetRoomId);
    }

    const seq = messagesLoadSeq;
    const showLoading = !silent
      && targetRoomId === String(currentRoomId || '')
      && !messages.length;

    if (showLoading) {
      messagesLoadingRoomId = targetRoomId;
      renderMessages();
    }

    const task = (async () => {
      try {
        if (silent && sending) return;

        const result = await withTimeout(
          window.api.teamChatListMessages?.({ roomId: targetRoomId }),
          MESSAGES_FETCH_TIMEOUT_MS,
          'Загрузка сообщений заняла слишком много времени. Проверьте интернет.',
        );
        if (!result?.ok) {
          if (!silent && targetRoomId === String(currentRoomId || '')) {
            setStatus(result?.message || 'Не удалось загрузить сообщения');
          }
          return;
        }
        if (result.roomId && String(result.roomId) !== targetRoomId) return;

        const serverMessages = messagesForRoom(result.messages || [], targetRoomId);
        const existing = getRoomState(targetRoomId).messages;
        const merged = mergeMessagesFromServer(targetRoomId, serverMessages, existing, { replace: true });
        const pinned = messagesForRoom(result.pinned || [], targetRoomId);
        setRoomState(targetRoomId, merged, pinned);

        if (isStaleMessagesLoad(seq, targetRoomId)) return;

        if (targetRoomId === String(currentRoomId || '')) {
          syncCurrentView();
          renderMessages();
          void window.api.teamChatMarkRead?.({ roomId: targetRoomId });
          if (!silent) setStatus('');
        }
      } catch (err) {
        if (!silent && targetRoomId === String(currentRoomId || '')) {
          setStatus(err?.message || 'Не удалось загрузить сообщения');
        }
      } finally {
        if (messagesLoadingRoomId === targetRoomId) {
          messagesLoadingRoomId = null;
          if (targetRoomId === String(currentRoomId || '')) renderMessages();
        }
      }
    })();

    messagesInflight.set(targetRoomId, task);
    try {
      return await task;
    } finally {
      messagesInflight.delete(targetRoomId);
    }
  }

  async function selectRoom(roomId, { silentMessages = false } = {}) {
    const nextRoomId = String(roomId || '').trim() || GENERAL_ROOM_ID;
    invalidateMessagesLoads();
    currentRoomId = nextRoomId;
    pendingAttachments = [];
    renderPendingAttachments();
    renderRooms();
    renderColleagues();
    renderHeader();

    syncCurrentView();
    const list = $('teamchat-messages');
    if (list) list.dataset.renderKey = '';
    const cachedCount = getRoomState(nextRoomId).messages.length;
    if (silentMessages && cachedCount > 0) {
      messagesLoadingRoomId = null;
    } else if (!messages.length) {
      messagesLoadingRoomId = nextRoomId;
    } else {
      messagesLoadingRoomId = null;
    }
    renderMessages();
    void loadMessages({ roomId: nextRoomId, silent: silentMessages || cachedCount > 0 });
  }

  async function openDm(colleagueId) {
    const result = await window.api.teamChatOpenDm?.({ recipientId: colleagueId });
    if (!result?.ok) {
      setStatus(result?.message || 'Не удалось открыть личный чат');
      return;
    }
    const colleague = colleagues.find((item) => item.id === colleagueId) || null;
    if (result.room?.id) {
      const enriched = {
        ...result.room,
        kind: 'dm',
        peer: colleague,
        title: colleague ? colleagueShortName(colleague) : result.room.title,
      };
      if (!rooms.some((item) => item.id === enriched.id)) {
        rooms = [...rooms, enriched];
      } else {
        rooms = rooms.map((item) => (item.id === enriched.id ? { ...item, ...enriched, peer: enriched.peer || item.peer } : item));
      }
      await selectRoom(enriched.id);
      void loadDirectory({ silent: true, previews: true });
    }
  }

  async function openTask(taskId) {
    const id = Number(taskId);
    if (!id) return;
    const result = await window.api.teamChatOpenTaskRoom?.({ taskId: id });
    if (!result?.ok) {
      window.openMetaskTask?.(id);
      return;
    }
    if (result.room?.id) {
      if (!rooms.some((item) => item.id === result.room.id)) {
        rooms = [...rooms, result.room];
      }
      await selectRoom(result.room.id);
      void loadDirectory({ silent: true, previews: true });
    }
  }

  async function pickAttachments() {
    if (!currentRoomId) {
      setStatus('Сначала выберите чат');
      return;
    }
    $('teamchat-file-input')?.click();
  }

  async function onFilesSelected(fileList) {
    const files = [...(fileList || [])];
    if (!files.length || !currentRoomId) return;
    for (const file of files.slice(0, 6 - pendingAttachments.length)) {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await window.api.teamChatUploadAttachment?.({
        dataUrl,
        filename: file.name,
        mime: file.type,
        roomId: currentRoomId,
      });
      if (uploaded?.ok && uploaded.attachment) {
        rememberAttachmentUrls([uploaded.attachment]);
        pendingAttachments.push(uploaded.attachment);
      } else {
        setStatus(uploaded?.message || 'Не удалось загрузить файл');
      }
    }
    renderPendingAttachments();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('read failed'));
      reader.readAsDataURL(file);
    });
  }

  async function sendMessage() {
    if (sending || !currentRoomId) return;
    const room = currentRoom();
    const targetRoomId = String(currentRoomId || '').trim();
    if (!targetRoomId) return;
    if (room?.kind === 'dm' && !room.peer?.id) {
      setStatus('Не удалось определить собеседника — подождите загрузку списка');
      return;
    }
    const input = $('teamchat-input');
    const body = String(input?.value || '').trim();
    if (!body && !pendingAttachments.length) return;

    const attachments = [...pendingAttachments];
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      room_id: targetRoomId,
      author_id: meId,
      body,
      attachments,
      task_ids: [],
      mention_ids: [],
      created_at: new Date().toISOString(),
      author: meProfile
        ? { ...meProfile, id: meId }
        : { id: meId, full_name: 'Вы', username: '', avatar_url: '' },
      pinned: false,
      pending: true,
    };

    sending = true;
    if (input) input.value = '';
    pendingAttachments = [];
    renderPendingAttachments();
    const roomBeforeSend = getRoomState(targetRoomId);
    const withOptimistic = [...roomBeforeSend.messages, optimistic];
    setRoomState(targetRoomId, withOptimistic, roomBeforeSend.pinned);
    if (targetRoomId === String(currentRoomId || '')) {
      syncCurrentView();
      renderMessages();
    }
    patchCurrentRoomPreview(body, targetRoomId);
    $('teamchat-send')?.setAttribute('disabled', 'true');

    try {
      const result = await window.api.teamChatSendMessage?.({
        roomId: targetRoomId,
        body,
        attachments,
        colleagues,
      });
      if (targetRoomId !== String(currentRoomId || '')) return;
      if (!result?.ok) {
        const restored = roomBeforeSend.messages.filter((message) => message.id !== tempId);
        setRoomState(targetRoomId, restored, roomBeforeSend.pinned);
        if (targetRoomId === String(currentRoomId || '')) {
          syncCurrentView();
          renderMessages();
        }
        if (input) input.value = body;
        pendingAttachments = attachments;
        renderPendingAttachments();
        setStatus(result?.message || 'Не удалось отправить');
        return;
      }
      const saved = enrichMessageAttachments({
        ...result.message,
        room_id: result.message.room_id || targetRoomId,
        pending: false,
        attachments: mergeAttachmentLists(result.message?.attachments, attachments),
      });
      const withoutTemp = getRoomState(targetRoomId).messages.filter((message) => message.id !== tempId);
      const merged = mergeMessagesFromServer(targetRoomId, [saved], withoutTemp, { replace: false });
      setRoomState(targetRoomId, merged, getRoomState(targetRoomId).pinned);
      if (targetRoomId === String(currentRoomId || '')) {
        syncCurrentView();
        renderMessages();
      }
      setStatus('');
      void loadDirectory({ silent: true, previews: true });
    } finally {
      sending = false;
      $('teamchat-send')?.removeAttribute('disabled');
    }
  }

  async function refreshAll({ silent = false, force = false } = {}) {
    const auth = window.getAuthState?.();
    let sessionUserId = auth?.user?.id;

    if (!sessionUserId) {
      const session = await window.api.authGetSession?.();
      sessionUserId = session?.user?.id;
      if (session?.profile) meProfile = session.profile;
    } else if (auth.profile) {
      meProfile = auth.profile;
    }

    if (!sessionUserId) {
      showAuthGate();
      return;
    }

    meId = sessionUserId;
    showWorkspace();
    hydrateFromDirectoryCache(meId);
    if (!rooms.length) {
      rooms = [buildFallbackGeneralRoom()];
      renderRooms();
      renderHeader();
    }
    renderColleagues();
    syncCurrentView();
    renderMessages();

    if (!silent) setStatus('Загрузка…');

    const directoryResult = await loadDirectory({ silent: true, previews: false, skipCache: force });
    void loadMeProfile();
    void loadMessages({ silent: true, roomId: currentRoomId });

    if (!directoryResult?.ok) {
      const cached = rooms.length > 1 || colleagues.length;
      if (cached) {
        setStatus(`${directoryResult.message || 'Не удалось обновить'} · показаны сохранённые данные`);
      } else if (isNetworkIssueMessage(directoryResult.message)) {
        setStatus(`${directoryResult.message || 'Supabase недоступен'} · нажмите ↻ для повтора`);
      } else {
        setStatus(directoryResult.message || 'Командный чат недоступен');
      }
      return;
    }
    setStatus('');
  }

  function startPolling() {
    stopPolling();
    messagesPollTimer = window.setInterval(() => {
      if (!active || !currentRoomId || sending) return;
      loadMessages({ silent: true });
    }, MESSAGES_POLL_MS);
    directoryPollTimer = window.setInterval(() => {
      if (!active) return;
      loadDirectory({ silent: true, previews: directoryPreviewsLoaded });
    }, DIRECTORY_POLL_MS);
  }

  function stopPolling() {
    if (messagesPollTimer) {
      clearInterval(messagesPollTimer);
      messagesPollTimer = null;
    }
    if (directoryPollTimer) {
      clearInterval(directoryPollTimer);
      directoryPollTimer = null;
    }
  }

  function bindOnce() {
    if (inited) return;
    inited = true;

    $('teamchat-send')?.addEventListener('click', () => sendMessage());
    $('teamchat-attach')?.addEventListener('click', () => pickAttachments());
    $('teamchat-refresh')?.addEventListener('click', () => refreshAll({ force: true }));
    $('teamchat-pin-room')?.addEventListener('click', () => togglePinRoom());
    $('teamchat-auth-login')?.addEventListener('click', () => {
      document.querySelector('.nav-item[data-page="settings"]')?.click();
    });

    $('teamchat-people-search')?.addEventListener('input', (event) => {
      peopleQuery = String(event.target.value || '');
      renderColleagues();
    });

    $('teamchat-input')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    $('teamchat-file-input')?.addEventListener('change', (event) => {
      onFilesSelected(event.target.files);
      event.target.value = '';
    });

    $('teamchat-messages')?.addEventListener('contextmenu', onMessageContextMenu);
    $('teamchat-context-menu')?.addEventListener('click', onContextMenuClick);
    document.addEventListener('click', () => hideContextMenu());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideContextMenu();
        closeForwardModal();
      }
    });
    $('teamchat-forward-overlay')?.addEventListener('click', (event) => {
      if (event.target === $('teamchat-forward-overlay')) closeForwardModal();
    });
    $('teamchat-forward-close')?.addEventListener('click', closeForwardModal);
    $('teamchat-forward-cancel')?.addEventListener('click', closeForwardModal);
    $('teamchat-forward-submit')?.addEventListener('click', () => submitForward());
    $('teamchat-forward-search')?.addEventListener('input', (event) => {
      forwardQuery = String(event.target.value || '');
      renderForwardColleagues();
    });
    $('teamchat-forward-list')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-forward-colleague]');
      if (!btn) return;
      forwardSelectedColleagueId = btn.getAttribute('data-forward-colleague');
      prewarmForwardDm(forwardSelectedColleagueId);
      const submit = $('teamchat-forward-submit');
      if (submit) submit.disabled = !forwardSelectedColleagueId;
      renderForwardColleagues();
    });

    window.addEventListener('auth-session-changed', () => {
      if (active) refreshAll();
    });

    window.addEventListener('user-avatar-updated', (event) => {
      const next = event.detail?.profile;
      if (next) meProfile = next;
      else void loadMeProfile();
      renderHeader();
      renderMessages();
      renderColleagues();
    });

    window.api.onTeamchatKonstanciaShareSent?.((detail) => {
      const { roomId, message, recipientId } = detail || {};
      if (roomId && message) ingestSharePingMessage(roomId, message, recipientId);
    });

    window.api.onTeamchatSharePingFailed?.((detail) => {
      if (!active) return;
      const msg = detail?.message || 'Не удалось отправить ссылку в «Команда»';
      setStatus(msg);
    });
  }

  async function activateTeamChatPage() {
    active = true;
    bindOnce();

    const auth = window.getAuthState?.();
    if (auth?.user?.id) {
      meId = auth.user.id;
      if (auth.profile) meProfile = auth.profile;
      showWorkspace();
      hydrateFromDirectoryCache(meId);
      if (!rooms.length) {
        rooms = [buildFallbackGeneralRoom()];
        renderRooms();
        renderHeader();
      }
      renderColleagues();
      renderMessages();
    } else {
      const session = await window.api.authGetSession?.();
      if (session?.user?.id) {
        meId = session.user.id;
        if (session.profile) meProfile = session.profile;
        showWorkspace();
        hydrateFromDirectoryCache(meId);
        if (!rooms.length) {
          rooms = [buildFallbackGeneralRoom()];
          renderRooms();
          renderHeader();
        }
        renderColleagues();
        renderMessages();
      } else {
        showAuthGate();
      }
    }

    void refreshAll({ silent: true });
    startPolling();
  }

  function buildFallbackGeneralRoom() {
    return {
      id: GENERAL_ROOM_ID,
      kind: 'general',
      title: 'Общий',
      lastMessage: null,
      unread: 0,
      pinned: false,
    };
  }

  function prefetchTeamChatDirectory() {
    if (!window.getAuthState?.()?.user?.id) return;
    void window.api.teamChatDirectory?.({ previews: false }).then((result) => {
      if (result?.ok) writeDirectoryCache(result);
    });
  }

  function deactivateTeamChatPage() {
    active = false;
    stopPolling();
  }

  async function openTeamChatRoom(roomId, { colleagueId = null } = {}) {
    document.querySelector('.nav-item[data-page="teamchat"]')?.click();
    if (!active) await activateTeamChatPage();
    const id = String(roomId || '').trim();
    if (id) {
      await selectRoom(id, { silentMessages: true });
      return;
    }
    const peerId = String(colleagueId || '').trim();
    if (peerId) await openDm(peerId);
  }

  window.activateTeamChatPage = activateTeamChatPage;
  window.deactivateTeamChatPage = deactivateTeamChatPage;
  window.openTeamChatTaskRoom = openTask;
  window.openTeamChatRoom = openTeamChatRoom;
  window.getCurrentTeamChatRoomId = () => currentRoomId;
  window.isTeamChatPageActive = () => active;
  window.prefetchTeamChatDirectory = prefetchTeamChatDirectory;
})();
