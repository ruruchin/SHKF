import { isSupabaseNetworkError, SUPABASE_OFFLINE_HINT } from './auth-service.js';
import {
  buildSharedChatPayload,
  formatKonstanciaSharePingMessage,
} from '../shared/agent-chat-share.js';

const COLLEAGUE_COLUMNS = 'id,email,full_name,username,position,avatar_url,role,is_active';
const SHARE_INSERT_COLUMNS = 'id,owner_id,recipient_id,title,owner_name,owner_username,status,created_at,accepted_at';
const SHARE_READ_COLUMNS = `${SHARE_INSERT_COLUMNS},payload`;

export class AgentChatShareService {
  constructor(authService, teamChatService = null) {
    this.authService = authService;
    this.teamChatService = teamChatService;
    this.onSharePingComplete = null;
    this.onSharePingFailed = null;
    this._pingInFlight = new Map();
    this._pingDone = new Set();
  }

  isReady() {
    return !!(this.authService?.client && this.authService?.session?.access_token);
  }

  async ensureSession() {
    if (!this.isReady()) {
      throw new Error('Войдите в SHKF, чтобы делиться чатами');
    }
    await this.authService.ensureClientSession();
    return this.authService.session.user.id;
  }

  formatError(err) {
    if (isSupabaseNetworkError(err)) return SUPABASE_OFFLINE_HINT;
    const msg = String(err?.message || err?.details || err || 'Ошибка обмена чатами').trim();
    if (/agent_chat_shares|schema cache/i.test(msg)) {
      return 'Сервис обмена чатами не настроен в Supabase. Обратитесь к администратору.';
    }
    return msg.slice(0, 240);
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
      return { ok: true, colleagues: data || [] };
    } catch (err) {
      return { ok: false, message: this.formatError(err), colleagues: [] };
    }
  }

  async findRecentPendingShare(me, recipientId, title) {
    const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data, error } = await this.authService.client
      .from('agent_chat_shares')
      .select(SHARE_INSERT_COLUMNS)
      .eq('owner_id', me)
      .eq('recipient_id', recipientId)
      .eq('title', title)
      .eq('status', 'pending')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  wrapSharePingMessage(data, me, profile = {}) {
    if (!data) return null;
    return {
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
    };
  }

  async forwardSharePing({ recipientId, title, shareId, ownerName = '', me = null, roomId = null }) {
    if (!this.teamChatService) {
      return { ok: false, message: 'Командный чат недоступен' };
    }
    try {
      const userId = me || await this.ensureSession();
      let dmRoomId = String(roomId || '').trim();
      if (!dmRoomId) {
        const dm = await this.teamChatService.openDmRoom(recipientId, { me: userId });
        if (!dm.ok || !dm.room?.id) {
          return { ok: false, message: dm.message || 'Не удалось открыть личный чат' };
        }
        dmRoomId = dm.room.id;
      }

      const existing = await this.teamChatService.findSharePingMessage(dmRoomId, shareId);
      if (existing?.id) {
        const profile = this.authService.profile || { id: userId };
        return {
          ok: true,
          roomId: dmRoomId,
          reused: true,
          message: this.wrapSharePingMessage(existing, userId, profile),
        };
      }

      const body = formatKonstanciaSharePingMessage({ ownerName, title, shareId });
      const sent = await this.teamChatService.insertRoomMessage({
        roomId: dmRoomId,
        body,
        me: userId,
        retries: 1,
        skipAccessCheck: true,
        lightweight: true,
      });
      if (!sent.ok) {
        console.warn('[agent-chat-share] ping insert failed:', sent.message, { shareId, recipientId, roomId: dmRoomId });
        return sent;
      }

      return {
        ok: true,
        roomId: dmRoomId,
        message: sent.message ? { ...sent.message, room_id: sent.message.room_id || dmRoomId } : null,
      };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async deliverSharePing({ recipientId, title, shareId, ownerName, me, dmResult = null }) {
    const id = String(shareId || '').trim();
    if (!id) return { ok: false, message: 'Не указан чат' };
    if (this._pingDone.has(id)) {
      return { ok: true, skipped: true };
    }
    if (this._pingInFlight.has(id)) {
      return this._pingInFlight.get(id);
    }

    const task = (async () => {
      const dmRoomId = dmResult?.ok && dmResult.room?.id ? dmResult.room.id : null;
      const teamChat = await this.forwardSharePing({
        recipientId,
        title,
        shareId: id,
        ownerName,
        me,
        roomId: dmRoomId,
      });

      if (teamChat?.ok) {
        this._pingDone.add(id);
        this.onSharePingComplete?.({
          shareId: id,
          recipientId,
          roomId: teamChat.roomId,
          message: teamChat.message,
        });
        return teamChat;
      }

      console.warn('[agent-chat-share] share saved, ping failed:', teamChat?.message, { shareId: id, recipientId });
      this.onSharePingFailed?.({
        shareId: id,
        recipientId,
        message: teamChat?.message || 'Не удалось отправить ссылку в «Команда»',
      });
      return teamChat;
    })();

    this._pingInFlight.set(id, task);
    try {
      return await task;
    } finally {
      this._pingInFlight.delete(id);
    }
  }

  async shareChat({ recipientId, session, payload: payloadHint } = {}) {
    try {
      const me = await this.ensureSession();
      const recipient = String(recipientId || '').trim();
      if (!recipient) return { ok: false, message: 'Выберите коллегу' };
      if (recipient === me) return { ok: false, message: 'Нельзя отправить чат самому себе' };

      const payload = payloadHint || buildSharedChatPayload(session);
      if (!payload.messages?.length) {
        return { ok: false, message: 'В чате нет сообщений для отправки' };
      }

      const profile = this.authService.profile;
      const ownerName = String(profile?.full_name || '').trim()
        || String(profile?.username || '').trim()
        || String(this.authService.session?.user?.email || '').split('@')[0]
        || 'Коллега';
      const ownerUsername = String(profile?.username || '').trim();

      const recentShare = await this.findRecentPendingShare(me, recipient, payload.title);
      if (recentShare?.id) {
        const dmResult = this.teamChatService
          ? await this.teamChatService.openDmRoom(recipient, { me })
          : { ok: false };
        void this.deliverSharePing({
          recipientId: recipient,
          title: payload.title,
          shareId: recentShare.id,
          ownerName,
          me,
          dmResult,
        });
        return {
          ok: true,
          share: recentShare,
          teamChat: { ok: true, pending: true, reused: true },
        };
      }

      const dmPromise = this.teamChatService
        ? this.teamChatService.openDmRoom(recipient, { me })
        : Promise.resolve({ ok: false });

      const insertPromise = this.authService.client
        .from('agent_chat_shares')
        .insert({
          owner_id: me,
          recipient_id: recipient,
          title: payload.title,
          owner_name: ownerName,
          owner_username: ownerUsername,
          payload,
          status: 'pending',
        })
        .select(SHARE_INSERT_COLUMNS)
        .single();

      const [insertResult, dmResult] = await Promise.all([insertPromise, dmPromise]);
      if (insertResult.error) throw insertResult.error;
      const data = insertResult.data;
      void this.deliverSharePing({
        recipientId: recipient,
        title: payload.title,
        shareId: data.id,
        ownerName,
        me,
        dmResult,
      });

      return {
        ok: true,
        share: data,
        teamChat: { ok: true, pending: true },
      };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async getShare(shareId) {
    try {
      const me = await this.ensureSession();
      const id = String(shareId || '').trim();
      if (!id) return { ok: false, message: 'Не указан чат' };

      const { data, error } = await this.authService.client
        .from('agent_chat_shares')
        .select(SHARE_READ_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ok: false, message: 'Чат не найден' };
      if (data.recipient_id !== me && data.owner_id !== me) {
        return { ok: false, message: 'Нет доступа к этому чату' };
      }
      return { ok: true, share: data };
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async listIncoming({ limit = 30 } = {}) {
    try {
      const me = await this.ensureSession();
      const { data, error } = await this.authService.client
        .from('agent_chat_shares')
        .select(SHARE_READ_COLUMNS)
        .eq('recipient_id', me)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(Number(limit) || 30, 50)));
      if (error) throw error;
      return { ok: true, shares: data || [] };
    } catch (err) {
      return { ok: false, message: this.formatError(err), shares: [] };
    }
  }

  async updateShareStatus(shareId, status) {
    const me = await this.ensureSession();
    const id = String(shareId || '').trim();
    if (!id) return { ok: false, message: 'Не указан чат' };

    const patch = { status };
    if (status === 'accepted') patch.accepted_at = new Date().toISOString();

    const { data, error } = await this.authService.client
      .from('agent_chat_shares')
      .update(patch)
      .eq('id', id)
      .eq('recipient_id', me)
      .eq('status', 'pending')
      .select(SHARE_READ_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, message: 'Чат не найден или уже обработан' };
    return { ok: true, share: data };
  }

  async acceptShare(shareId) {
    try {
      return await this.updateShareStatus(shareId, 'accepted');
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }

  async dismissShare(shareId) {
    try {
      return await this.updateShareStatus(shareId, 'dismissed');
    } catch (err) {
      return { ok: false, message: this.formatError(err) };
    }
  }
}
