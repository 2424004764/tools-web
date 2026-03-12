/**
 * Supabase 客户端配置
 * 用于临时聊天室的实时通信
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
};

export default supabase;
