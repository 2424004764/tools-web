/**
 * Supabase 客户端配置
 * 用于临时聊天室 / 表白墙 / 五子棋的实时通信
 *
 * 安全约定：前端不再持有任何真实 Supabase URL 与密钥（原先 VITE_SUPABASE_URL +
 * anon key 直连，可被提取后绕过站点直接读写数据库）。client 的 baseURL 指向
 * 同源 /sb，REST 与 Realtime WebSocket 全部经 Cloudflare Pages Functions 代理
 * （functions/sb/[[path]].js），真实密钥由代理在服务端注入。
 * 这里的 key 是占位符（supabase-js 要求非空），代理会直接丢弃。
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = `${location.origin}/sb`;
const supabaseProxyKey = 'public-proxy';

export const supabase = createClient(supabaseUrl, supabaseProxyKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * 聊天室数据库操作
 */
export const chatDb = {
  /**
   * 发送消息
   */
  async sendMessage(roomId: string, nickname: string, content: string, replyTo?: { id: string; nickname: string; content: string }) {
    const insertData: any = {
      room_id: roomId.toUpperCase(),
      nickname,
      content,
    };

    if (replyTo) {
      insertData.reply_to = replyTo;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * 获取历史消息（支持分页）
   */
  async getMessages(roomId: string, limit = 50, offset = 0) {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId.toUpperCase())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (offset > 0) {
      // 从 offset 条之后开始获取
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    // 反转顺序，使最早的在前
    return data ? data.reverse() : [];
  },

  /**
   * 撤回消息
   */
  async revokeMessage(roomId: string, messageId: string) {
    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        content: '消息已撤回',
        revoked: true,
      })
      .eq('id', messageId)
      .eq('room_id', roomId.toUpperCase())
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * 订阅房间消息
   */
  subscribeToRoom(roomId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`chat-room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId.toUpperCase()}`,
        },
        callback
      )
      .subscribe();
  },

  /**
   * 订阅在线用户状态 (使用 Presence)
   */
  subscribePresence(roomId: string, callbacks: {
    onJoin?: (presences: any) => void;
    onLeave?: (presences: any) => void;
    onSync?: () => void;
  }) {
    const channel = supabase.channel(`chat-presence-${roomId}`);

    if (callbacks.onSync) {
      channel.on('presence', { event: 'sync' }, callbacks.onSync);
    }
    if (callbacks.onJoin) {
      channel.on('presence', { event: 'join' }, callbacks.onJoin);
    }
    if (callbacks.onLeave) {
      channel.on('presence', { event: 'leave' }, callbacks.onLeave);
    }

    return channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // 自动追踪当前用户状态
        channel.track({ online_at: new Date().toISOString() });
      }
    });
  },

  /**
   * 更新用户在线状态
   */
  async trackUser(channel: any, nickname: string) {
    return channel.track({
      nickname,
      online_at: new Date().toISOString(),
    });
  },

  /**
   * 获取当前在线用户
   */
  getPresenceState(channel: any) {
    return channel.presenceState();
  },

  /**
   * 清理旧消息 (可选功能)
   */
  async cleanOldMessages(roomId: string, minutes = 60) {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('room_id', roomId.toUpperCase())
      .lt('created_at', cutoffTime);
    if (error) throw error;
  },

  /**
   * 创建房间
   */
  async createRoom(roomId: string, roomName: string) {
    const { error } = await supabase
      .from('chat_rooms')
      .insert({
        id: roomId.toUpperCase(),
        room_name: roomName || `房间 ${roomId.toUpperCase()}`,
        ephemeral_mode: false,
        announcement: '',
      });
    if (error) throw error;
  },

  /**
   * 获取房间配置
   */
  async getRoomConfig(roomId: string) {
    const { data, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * 设置房间临时模式
   */
  async setEphemeralMode(roomId: string, enabled: boolean) {
    const { error } = await supabase
      .from('chat_rooms')
      .update({
        ephemeral_mode: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId.toUpperCase());
    if (error) throw error;
  },

  /**
   * 更新房间公告
   */
  async updateAnnouncement(roomId: string, announcement: string) {
    const { error } = await supabase
      .from('chat_rooms')
      .update({
        announcement,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId.toUpperCase());
    if (error) throw error;
  },

  /**
   * 更新房间名称
   */
  async updateRoomName(roomId: string, roomName: string) {
    const { error } = await supabase
      .from('chat_rooms')
      .update({
        room_name: roomName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId.toUpperCase());
    if (error) throw error;
  },
};

export default supabase;
