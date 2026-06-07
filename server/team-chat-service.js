import { randomUUID } from 'crypto';
import { isSupabaseNetworkError, SUPABASE_OFFLINE_HINT } from './auth-service.js';
import {
  TEAM_CHAT_GENERAL_ROOM_ID,
  TEAM_CHAT_MAX_ATTACHMENT_BYTES,
  buildDmTitle,
  buildTaskRoomTitle,
  buildForwardMeta,
  normalizeDmPair,
  parseTaskRefs,
  parseMentionUsernames,
  resolveMentionIds,
  sanitizeAttachments,
  sanitizeMessageBody,
} from '../shared/team-chat.js';

const COLLEAGUE_COLUMNS = 'id,email,full_name,username,position,avatar_url,role,is_active';
const ROOM_COLUMNS = 'id,kind,title,task_id,dm_low,dm_high,created_at,updated_at';
const MESSAGE_COLUMNS = 'id,room_id,author_id,body,attachments,task_ids,mention_ids,meta,created_at';
const SIGNED_URL_TTL = 60 * 60;

export class TeamChatService {
  constructor(authService) {
    this.authService = authService;
    this._directoryCache = new Map();
    this._messagesInflight = new Map();
    this._dmRoomCache = new Map();
  }

  _directoryCacheKey(me, previews) {
    return `${me}:${previews ? 'full' : 'light'}`;
  }

  _readDirectoryCache(me, previews) {
    const entry = this._directoryCache.get(this._directoryCacheKey(me, previews));
    if (!entry) return null;
    if (Date.now() - entry.at > 20_000) return null;
    return entry.data;
  }

  _writeDirectoryCache(me, previews, data) {
    this._directoryCache.set(this._directoryCacheKey(me, previews), { at: Date.now(), data });
  }

  _clearDirectoryCache(me) {
    if (!me) {
      this._directoryCache.clear();
      return;
    }
    this._directoryCache.delete(this._directoryCacheKey(me, true));
    this._directoryCache.delete(this._directoryCacheKey(me, false));
  }

  isReady() {
    return !!(this.authService?.client && this.authService?.session?.access_token);
  }

  async ensureSession() {
    if (!this.isReady()) {
      throw new Error('Войдите в SHKF, чтобы пользоваться командным чатом');
    }
    await this.authService.ensureClientSession();
    return this.authService.session.user.id;
  }

  formatError(err) {
    if (isSupabaseNetworkError(err)) return SUPABASE_OFFLINE_HINT;
    const msg = String(err?.message || err?.details || err?.hint || err || '').trim();
    return msg.slice(0, 240) || 'Ошибка командного чата';
  }

  async findSharePingMessage(roomId, shareId) {
    const room = String(roomId || '').trim();
    const id = String(shareId || '').trim();
    if (!room || !id) return null;
    const marker = `[konstancia-share:${id}]`;

    const { data, error } = await this.authService.client
      .from('team_chat_messages')
      .select('id,room_id,author_id,body,task_ids,mention_ids,meta,created_at')
      .eq('room_id', room)
      .ilike('body', `%${id}%`)
      .order('created_at', { ascending: false })
      .limit(3);
    if (error) throw error;

    return (data || []).find((row) => String(row.body || '').includes(marker)) || null;
  }

  async insertRoomMessage({
    roomId,
    body,
    me: meHint = null,
    retries = 3,
    skipAccessCheck = false,
    lightweight = false,
  } = {}) {
    const id = String(roomId || '').trim();
    if (!id) return { ok: false, message: 'Комната не выбрана' };

    const me = meHint || await this.ensureSession();
    if (!skipAccessCheck) await this.assertRoomAccess(id, me);

    const text = sanitizeMessageBody(body);
    if (!text) return { ok: false, message: 'Пустое сообщение' };

    const profile = this.authService.profile || { id: me };
    let lastErr = null;

    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
        }
        if (attempt > 0 || !meHint) {
          await this.authService.ensureClientSession();
        }

        const { data, error } = await this.authService.client
          .from('team_chat_messages')
          .insert({
            room_id: id,
            author_id: me,
            body: text,
            attachments: [],
            task_ids: [],
            mention_ids: [],
            meta: {},
          })
          .select('id,room_id,author_id,body,task_ids,mention_ids,meta,created_at')
          .single();
        if (error) throw error;

        if (!lightweight) {
          this._clearDirectoryCache(me);
          void this.markRead(id);
        }

        return {
          ok: true,
          message: {
            ...data,
            meta: data?.meta && typeof data.meta === 'object' ? data.meta : {},
            author: {
              id: me,
              full_name: profile.full_name || '',
              username: profile.username || '',
              avatar_url: profile.avatar_url || '',
              position: profile.position || '',
              role: profile.role || 'designer',
            },
            attachments: [],
            pinned: false,
          },
        };
      } catch (err) {
        lastErr = err;
        if (!isSupabaseNetworkError(err)) break;
      }
    }

    return { ok: false, message: this.formatError(lastErr) };
  }

  async signAttachment(item = {}) {
    const path = String(item?.path || '').trim();
    if (!path) return String(item?.url || '').trim();
    try {
      const { data, error } = await this.authService.client.storage
        .from('team-chat')
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (error) throw error;
      return data?.signedUrl || '';
    } catch {
      return '';
    }
  }

  async hydrateAttachments(items = [], { sign = true } = {}) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return [];
    if (!sign) {
      return list.map((item) => ({ ...item, url: String(item?.url || '').trim() }));
    }
    return Promise.all(list.map(async (item) => ({
      ...item,
      url: await this.signAttachment(item),
    })));
  }

  async listColleagues() {
    try {
      const me = await this.ensureSession();
      const { data, error } = await this.authService.client
        .from('profiles')
        .select(COLLEAGUE_COLUMNS)
        .eq('is_active', true)
        .neq('id', me)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return { ok: true, colleagues: data || [], meId: me };
    } catch (err) {
      return { ok: false, message: this.formatError(err), colleagues: [], meId: null };
    }
  }

  async loadRoomPins(me) {
    const { data, error } = await this.authService.client
      .from('team_chat_room_pins')
      .select('room_id,pinned_at')
      .eq('user_id', me);
    if (error) throw error;
    return new Map((data || []).map((row) => [row.room_id, row.pinned_at]));
  }

  async enrichRooms(visibleRooms, me, pinMap, readMap) {
    if (!visibleRooms.length) return [];

    const roomIds = visibleRooms.map((room) => room.id);
    const [{ data: recentMessages, error: msgError }, peerProfiles] = await Promise.all([
      this.authService.client
        .from('team_chat_messages')
        .select('room_id,body,created_at,author_id')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(roomIds.length * 5, 120)),
      this.loadDmPeerProfiles(visibleRooms, me),
    ]);
    if (msgError) throw msgError;

    const lastByRoom = new Map();
    for (const message of recentMessages || []) {
      if (!lastByRoom.has(message.room_id)) lastByRoom.set(message.room_id, message);
    }

    return visibleRooms.map((room) => {
      const lastMessage = lastByRoom.get(room.id) || null;
      const lastRead = readMap.get(room.id);
      let unread = 0;
      if (lastMessage?.created_at && (!lastRead || new Date(lastMessage.created_at) > new Date(lastRead))) {
        unread = 1;
      }

      let peer = null;
      if (room.kind === 'dm') {
        const peerId = room.dm_low === me ? room.dm_high : room.dm_low;
        peer = peerProfiles.get(peerId) || null;
      }

      return {
        ...room,
        title: room.kind === 'dm' && peer ? buildDmTitle(peer) : room.title,
        peer,
        lastMessage,
        unread,
        pinned: pinMap.has(room.id),
        pinnedAt: pinMap.get(room.id) || null,
      };
    });
  }

  async loadDmPeerProfiles(rooms, me) {
    const peerIds = [...new Set(
      rooms
        .filter((room) => room.kind === 'dm')
        .map((room) => (room.dm_low === me ? room.dm_high : room.dm_low))
        .filter(Boolean),
    )];
    if (!peerIds.length) return new Map();

    const { data, error } = await this.authService.client
      .from('profiles')
      .select(COLLEAGUE_COLUMNS)
      .in('id', peerIds);
    if (error) throw error;
    return new Map((data || []).map((profile) => [profile.id, profile]));
  }

  sortRooms(rooms) {
    return [...rooms].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.pinned && b.pinned) {
        return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
      }
      if (a.kind === 'general') return -1;
      if (b.kind === 'general') return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }

  async assertRoomAccess(roomId, me) {
    const id = String(roomId || '').trim();
    if (!id) throw new Error('Комната не выбрана');

    const { data: room, error } = await this.authService.client
      .from('team_chat_rooms')
      .select(ROOM_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!room) throw new Error('Чат не найден');

    if (room.kind === 'general' || room.kind === 'task') return room;
    if (room.kind === 'dm') {
      if (room.dm_low === me || room.dm_high === me) return room;
      throw new Error('Нет доступа к этой переписке');
    }
    throw new Error('Нет доступа к этой переписке');
  }

  async ensureGeneralRoom() {
    const { data, error } = await this.authService.client
      .from('team_chat_rooms')
      .select(ROOM_COLUMNS)
      .eq('kind', 'general')
      .maybeSingle();
    if (error) throw error;
    if (data) return data;

    const { data: created, error: insertError } = await this.authService.client
      .from('team_chat_rooms')
      .insert({
        id: TEAM_CHAT_GENERAL_ROOM_ID,
        kind: 'general',
        title: 'Общий',
      })
      .select(ROOM_COLUMNS)
      .single();
    if (insertError) throw insertError;
    return created;
  }

  mapRoomsLight(visibleRooms, me, pinMap, profileMap) {
    return visibleRooms.map((room) => {
      let peer = null;
      if (room.kind === 'dm') {
        const peerId = room.dm_low === me ? room.dm_high : room.dm_low;
        peer = profileMap.get(peerId) || null;
      }
      return {
        ...room,
        title: room.kind === 'dm' && peer ? buildDmTitle(peer) : room.title,
        peer,
        lastMessage: null,
        unread: 0,
        pinned: pinMap.has(room.id),
        pinnedAt: pinMap.get(room.id) || null,
      };
    });
  }

  buildGeneralRoomStub() {
    return {
      id: TEAM_CHAT_GENERAL_ROOM_ID,
      kind: 'general',
      title: 'Общий',
      task_id: null,
      dm_low: null,
      dm_high: null,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
  }

  async listDirectory({ previews = true, skipCache = false } = {}) {
    try {
      const me = await this.ensureSession();
      if (!skipCache) {
        const cached = this._readDirectoryCache(me, previews);
        if (cached) return cached;
      }

      const [
        { data: profiles, error: profilesError },
        { data: roomsRaw, error: roomsError },
        pinMap,
      ] = await Promise.all([
        this.authService.client
          .from('profiles')
          .select(COLLEAGUE_COLUMNS)
          .eq('is_active', true)
          .neq('id', me)
          .order('full_name', { ascending: true }),
        this.authService.client
          .from('team_chat_rooms')
          .select(ROOM_COLUMNS)
          .order('updated_at', { ascending: false }),
        this.loadRoomPins(me),
      ]);
      if (profilesError) throw profilesError;
      if (roomsError) throw roomsError;

      let roomsList = roomsRaw || [];
      if (!roomsList.some((room) => room.kind === 'general')) {
        roomsList = [this.buildGeneralRoomStub(), ...roomsList];
        void this.ensureGeneralRoom().catch(() => {});
      }

      const visibleRooms = roomsList.filter((room) => {
        if (room.kind === 'general' || room.kind === 'task') return true;
        if (room.kind === 'dm') return room.dm_low === me || room.dm_high === me;
        return false;
      });

      const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

      let readMap = new Map();
      let rooms;
      if (previews) {
        const roomIds = visibleRooms.map((room) => room.id);
        if (roomIds.length) {
          const { data: readRows, error: readError } = await this.authService.client
            .from('team_chat_reads')
            .select('room_id,last_read_at')
            .eq('user_id', me)
            .in('room_id', roomIds);
          if (readError) throw readError;
          readMap = new Map((readRows || []).map((row) => [row.room_id, row.last_read_at]));
        }
        rooms = this.sortRooms(
          await this.enrichRooms(visibleRooms, me, pinMap, readMap),
        );
      } else {
        rooms = this.sortRooms(this.mapRoomsLight(visibleRooms, me, pinMap, profileMap));
      }

      const dmByPeer = new Map();
      for (const room of rooms) {
        if (room.kind !== 'dm' || !room.peer?.id) continue;
        dmByPeer.set(room.peer.id, room);
      }

      const colleagues = (profiles || []).map((profile) => {
        const dm = dmByPeer.get(profile.id);
        return {
          ...profile,
          dmRoomId: dm?.id || null,
          unread: dm?.unread || 0,
          lastMessage: dm?.lastMessage || null,
          pinned: dm?.pinned || false,
          pinnedAt: dm?.pinnedAt || null,
        };
      }).sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.pinned && b.pinned) {
          return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
        }
        const nameA = String(a.full_name || a.username || '').toLowerCase();
        const nameB = String(b.full_name || b.username || '').toLowerCase();
        return nameA.localeCompare(nameB, 'ru');
      });

      const unreadTeam = rooms
        .filter((room) => room.kind === 'general' || room.kind === 'dm')
        .reduce((sum, room) => sum + (Number(room.unread) || 0), 0);

      const result = {
        ok: true,
        meId: me,
        colleagues,
        rooms: rooms.filter((room) => room.kind !== 'dm'),
        dmRooms: rooms.filter((room) => room.kind === 'dm'),
        unreadTeam,
      };
      this._writeDirectoryCache(me, previews, result);
      return result;
    } catch (err) {
      return {
        ok: false,
        message: this.formatError(err),
        colleagues: [],
        rooms: [],
        dmRooms: [],
        meId: null,
        unreadTeam: 0,
      };
    }
  }

  async listRooms() {
    const directory = await this.listDirectory();
    if (!directory.ok) return directory;
    return {
      ok: true,
      rooms: [...directory.rooms, ...directory.dmRooms],
      meId: directory.meId,
    };
  }

  async openDmRoom(recipientId, { me: meHint = null } = {}) {
    try {
      const me = meHint || await this.ensureSession();
      const recipient = String(recipientId || '').trim();
      if (!recipient) return { ok: false, message: 'Выберите коллегу' };
      if (recipient === me) return { ok: false, message: 'Нельзя открыть чат с самим собой' };

      const pair = normalizeDmPair(me, recipient);
      if (!pair) return { ok: false, message: 'Некорректный собеседник' };

      const cacheKey = `${pair.dmLow}:${pair.dmHigh}`;
      const cached = this._dmRoomCache.get(cacheKey);
      if (cached?.id) return { ok: true, room: cached };

      const { data: existing, error: findError } = await this.authService.client
        .from('team_chat_rooms')
        .select(ROOM_COLUMNS)
        .eq('kind', 'dm')
        .eq('dm_low', pair.dmLow)
        .eq('dm_high', pair.dmHigh)
        .maybeSingle();
      if (findError) throw findError;
      if (existing) {
        this._dmRoomCache.set(cacheKey, existing);
        return { ok: true, room: existing };
      }

      const { data: profile, error: profileError } = await this.authService.client
        .from('profiles')
        .select(COLLEAGUE_COLUMNS)
        .eq('id', recipient)
        .eq('is_active', true)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return { ok: false, message: 'Сотрудник не найден или неактивен' };

      const { data: created, error: insertError } = await this.authService.client
        .from('team_chat_rooms')
        .insert({
          kind: 'dm',
          title: buildDmTitle(profile),
          dm_low: pair.dmLow,
          dm_high: pair.dmHigh,
        })
        .select(ROOM_COLUMNS)
        .single();
      if (insertError) throw insertError;
      this._dmRoomCache.set(cacheKey, created);
      return { ok: true, room: created };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async openTaskRoom(taskId, subject = '') {
    try {
      await this.ensureSession();
      const id = Number(taskId);
      if (!id) return { ok: false, message: 'Некорректный номер задачи' };

      const { data: existing, error: findError } = await this.authService.client
        .from('team_chat_rooms')
        .select(ROOM_COLUMNS)
        .eq('kind', 'task')
        .eq('task_id', id)
        .maybeSingle();
      if (findError) throw findError;
      if (existing) return { ok: true, room: existing };

      const { data: created, error: insertError } = await this.authService.client
        .from('team_chat_rooms')
        .insert({
          kind: 'task',
          task_id: id,
          title: buildTaskRoomTitle(id, subject),
        })
        .select(ROOM_COLUMNS)
        .single();
      if (insertError) throw insertError;
      return { ok: true, room: created };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async listPinnedMessages(roomId) {
    const id = String(roomId || '').trim();
    if (!id) return [];
    const { data, error } = await this.authService.client
      .from('team_chat_pinned_messages')
      .select('message_id,pinned_at,pinned_by')
      .eq('room_id', id)
      .order('pinned_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async listMessages({ roomId, limit = 60, before = null, signAttachments = true } = {}) {
    const id = String(roomId || '').trim();
    if (!id) return { ok: false, message: 'Комната не выбрана', messages: [], pinned: [] };

    const inflightKey = `${id}:${before || ''}:${limit}`;
    if (this._messagesInflight.has(inflightKey)) {
      return this._messagesInflight.get(inflightKey);
    }

    const task = this._fetchRoomMessages({ roomId: id, limit, before, signAttachments });
    this._messagesInflight.set(inflightKey, task);
    try {
      return await task;
    } finally {
      this._messagesInflight.delete(inflightKey);
    }
  }

  async _fetchRoomMessages({ roomId, limit = 60, before = null, signAttachments = true } = {}) {
    try {
      await this.ensureSession();
      const id = String(roomId || '').trim();
      if (!id) return { ok: false, message: 'Комната не выбрана', messages: [], pinned: [] };

      const pageLimit = Math.max(1, Math.min(Number(limit) || 60, 100));
      const { data, error } = await this.authService.client.rpc('team_chat_list_room_messages', {
        p_room_id: id,
        p_limit: pageLimit,
      });
      if (error) throw error;

      let rows = Array.isArray(data) ? data : [];
      if (before) {
        const cutoff = new Date(before).getTime();
        rows = rows.filter((row) => new Date(row.created_at).getTime() < cutoff);
      }

      const hydrated = await Promise.all(rows.map(async (row) => {
        const attachments = Array.isArray(row.attachments) ? row.attachments : [];
        const author = row.author && typeof row.author === 'object' ? row.author : null;
        return {
          id: row.id,
          room_id: row.room_id,
          author_id: row.author_id,
          body: row.body,
          task_ids: row.task_ids || [],
          mention_ids: row.mention_ids || [],
          meta: row.meta && typeof row.meta === 'object' ? row.meta : {},
          created_at: row.created_at,
          author,
          pinned: !!row.pinned,
          attachments: attachments.length
            ? await this.hydrateAttachments(attachments, { sign: signAttachments })
            : [],
        };
      }));

      const pinnedMessages = hydrated.filter((m) => m.pinned);

      return {
        ok: true,
        roomId: id,
        messages: hydrated,
        pinned: pinnedMessages,
        pinnedIds: pinnedMessages.map((m) => m.id),
      };
    } catch (err) {
      return { ok: false, message: this.formatError(err), messages: [], pinned: [] };
    }
  }

  async markRead(roomId) {
    try {
      const me = await this.ensureSession();
      const id = String(roomId || '').trim();
      if (!id) return { ok: false, message: 'Комната не выбрана' };

      const { error } = await this.authService.client
        .from('team_chat_reads')
        .upsert({
          room_id: id,
          user_id: me,
          last_read_at: new Date().toISOString(),
        }, { onConflict: 'room_id,user_id' });
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async pinRoom(roomId) {
    try {
      const me = await this.ensureSession();
      const id = String(roomId || '').trim();
      if (!id) return { ok: false, message: 'Комната не выбрана' };
      const { error } = await this.authService.client
        .from('team_chat_room_pins')
        .upsert({ user_id: me, room_id: id, pinned_at: new Date().toISOString() }, {
          onConflict: 'user_id,room_id',
        });
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async unpinRoom(roomId) {
    try {
      const me = await this.ensureSession();
      const id = String(roomId || '').trim();
      if (!id) return { ok: false, message: 'Комната не выбрана' };
      const { error } = await this.authService.client
        .from('team_chat_room_pins')
        .delete()
        .eq('user_id', me)
        .eq('room_id', id);
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async pinMessage({ roomId, messageId } = {}) {
    try {
      const me = await this.ensureSession();
      const room = String(roomId || '').trim();
      const message = String(messageId || '').trim();
      if (!room || !message) return { ok: false, message: 'Не указано сообщение' };
      const { error } = await this.authService.client
        .from('team_chat_pinned_messages')
        .upsert({
          room_id: room,
          message_id: message,
          pinned_by: me,
          pinned_at: new Date().toISOString(),
        }, { onConflict: 'room_id,message_id' });
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async unpinMessage({ roomId, messageId } = {}) {
    try {
      await this.ensureSession();
      const room = String(roomId || '').trim();
      const message = String(messageId || '').trim();
      if (!room || !message) return { ok: false, message: 'Не указано сообщение' };
      const { error } = await this.authService.client
        .from('team_chat_pinned_messages')
        .delete()
        .eq('room_id', room)
        .eq('message_id', message);
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async uploadAttachment({ dataUrl, filename = 'file', mime = '', roomId } = {}) {
    try {
      const me = await this.ensureSession();
      const room = String(roomId || '').trim();
      if (!room) return { ok: false, message: 'Сначала выберите чат' };

      const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/i);
      if (!match) return { ok: false, message: 'Неподдерживаемый формат файла' };

      const contentType = mime || match[1];
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > TEAM_CHAT_MAX_ATTACHMENT_BYTES) {
        return { ok: false, message: 'Файл слишком большой (макс. 8 МБ)' };
      }

      const safeName = String(filename || 'file')
        .replace(/[^\w.\-()+\s\u0400-\u04FF]/gi, '_')
        .slice(0, 120) || 'file';
      const ext = safeName.includes('.') ? safeName.split('.').pop() : contentType.split('/')[1] || 'bin';
      const filePath = `${room}/${me}/${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;

      const { error: upErr } = await this.authService.client.storage
        .from('team-chat')
        .upload(filePath, buffer, { contentType, upsert: false });
      if (upErr) throw upErr;

      const url = await this.signAttachment({ path: filePath });
      return {
        ok: true,
        attachment: {
          id: randomUUID(),
          name: safeName,
          path: filePath,
          url,
          mime: contentType,
          size: buffer.length,
        },
      };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async sendMessage({
    roomId,
    body,
    attachments = [],
    taskIds = null,
    mentionIds = null,
    colleagues = [],
    meta = null,
    me: meHint = null,
    skipAccessCheck = false,
    skipHydrateAttachments = false,
  } = {}) {
    try {
      const me = meHint || await this.ensureSession();
      const id = String(roomId || '').trim();
      if (!id) return { ok: false, message: 'Комната не выбрана' };

      if (!skipAccessCheck) await this.assertRoomAccess(id, me);

      const text = sanitizeMessageBody(body);
      const files = sanitizeAttachments(attachments);
      if (!text && !files.length) return { ok: false, message: 'Пустое сообщение' };

      const parsedTaskIds = taskIds?.length ? taskIds : parseTaskRefs(text);
      let parsedMentions = mentionIds?.length ? mentionIds : [];
      if (!parsedMentions.length && parseMentionUsernames(text).length) {
        parsedMentions = resolveMentionIds(text, colleagues);
      }

      const { data, error } = await this.authService.client
        .from('team_chat_messages')
        .insert({
          room_id: id,
          author_id: me,
          body: text,
          attachments: [],
          task_ids: parsedTaskIds,
          mention_ids: parsedMentions,
          meta: meta && typeof meta === 'object' ? meta : {},
        })
        .select(MESSAGE_COLUMNS)
        .single();
      if (error) throw error;

      if (files.length) {
        const { error: attachError } = await this.authService.client
          .from('team_chat_message_attachments')
          .insert(files.map((file, index) => ({
            message_id: data.id,
            storage_path: file.path,
            file_name: file.name || 'file',
            mime_type: file.mime || 'application/octet-stream',
            byte_size: Number(file.size) || 0,
            sort_order: index,
          })));
        if (attachError) throw attachError;
      }

      const isSimple = !files.length && !parsedTaskIds.length && !parsedMentions.length
        && !(meta && typeof meta === 'object' && Object.keys(meta).length);

      if (!isSimple) {
        this._clearDirectoryCache(me);
      }
      const profile = this.authService.profile || { id: me };
      void this.markRead(id);

      const hasAttachments = files.length > 0;
      return {
        ok: true,
        message: {
          ...data,
          meta: data.meta && typeof data.meta === 'object' ? data.meta : {},
          author: {
            id: me,
            full_name: profile.full_name || '',
            username: profile.username || '',
            avatar_url: profile.avatar_url || '',
            position: profile.position || '',
            role: profile.role || 'designer',
          },
          attachments: hasAttachments
            ? (skipHydrateAttachments
              ? files.map((file) => ({
                id: file.id || '',
                name: file.name || 'file',
                path: file.path || '',
                mime: file.mime || '',
                size: file.size || 0,
                url: file.url || '',
              }))
              : await this.hydrateAttachments(files))
            : [],
          pinned: false,
        },
      };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  profileDisplayName(profile = {}) {
    const name = String(profile.full_name || '').trim();
    const username = String(profile.username || '').trim();
    const emailLogin = String(profile.email || '').split('@')[0]?.trim();
    if (name) return name;
    if (username) return `@${username}`;
    if (emailLogin) return emailLogin;
    return 'Коллега';
  }

  async resolveMessageAuthorName(authorId, fallbackAuthor = null) {
    const id = String(authorId || '').trim();
    if (!id) return this.profileDisplayName(fallbackAuthor || {});
    if (id === this.authService.session?.user?.id && this.authService.profile) {
      return this.profileDisplayName(this.authService.profile);
    }
    if (fallbackAuthor && String(fallbackAuthor.id || '') === id) {
      return this.profileDisplayName(fallbackAuthor);
    }
    const { data } = await this.authService.client
      .from('profiles')
      .select(COLLEAGUE_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    return this.profileDisplayName(data || fallbackAuthor || {});
  }

  async forwardMessage({ messageId, recipientId } = {}) {
    try {
      const me = await this.ensureSession();
      const msgId = String(messageId || '').trim();
      const recipient = String(recipientId || '').trim();
      if (!msgId) return { ok: false, message: 'Сообщение не выбрано' };
      if (!recipient) return { ok: false, message: 'Выберите получателя' };
      if (recipient === me) return { ok: false, message: 'Нельзя переслать самому себе' };

      const { data: source, error: fetchErr } = await this.authService.client
        .from('team_chat_messages')
        .select(`${MESSAGE_COLUMNS}`)
        .eq('id', msgId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!source) return { ok: false, message: 'Сообщение не найдено' };

      await this.assertRoomAccess(source.room_id, me);

      const authorId = String(source.author_id || '').trim();
      const [attachResult, authorResult, dm] = await Promise.all([
        this.authService.client
          .from('team_chat_message_attachments')
          .select('storage_path, file_name, mime_type, byte_size, sort_order')
          .eq('message_id', msgId)
          .order('sort_order'),
        authorId
          ? this.authService.client
            .from('profiles')
            .select(COLLEAGUE_COLUMNS)
            .eq('id', authorId)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        this.openDmRoom(recipient, { me }),
      ]);

      if (attachResult.error) throw attachResult.error;
      if (authorResult.error) throw authorResult.error;
      if (!dm.ok || !dm.room?.id) {
        return { ok: false, message: dm.message || 'Не удалось открыть личный чат' };
      }

      let attachments = (attachResult.data || []).map((row) => ({
        path: row.storage_path,
        name: row.file_name,
        mime: row.mime_type,
        size: row.byte_size,
      }));

      if (!attachments.length && Array.isArray(source.attachments) && source.attachments.length) {
        attachments = sanitizeAttachments(source.attachments);
      }

      const authorRow = authorResult.data || source.author || null;
      const authorName = this.profileDisplayName(authorRow || {});
      const forwardMeta = buildForwardMeta({ ...source, author: authorRow }, authorName);
      if (!forwardMeta) return { ok: false, message: 'Не удалось подготовить пересылку' };

      const sent = await this.sendMessage({
        roomId: dm.room.id,
        body: source.body,
        attachments,
        taskIds: source.task_ids || [],
        meta: forwardMeta,
        me,
        skipAccessCheck: true,
        skipHydrateAttachments: true,
      });
      if (!sent.ok) return sent;
      return { ok: true, roomId: dm.room.id, message: sent.message };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }
}
