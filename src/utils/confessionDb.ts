/**
 * 匿名告白墙 数据库操作
 *
 * 数据层：
 *   - 告白消息、反应、分组读取 → 直接调用 Supabase REST（anon key）
 *   - 分组创建/删除 → 通过 Cloudflare Function（/api/confession/groups/*），
 *                     由后端校验 JWT + user.is_admin 后用 service_role 写入
 *
 * 管理员判断：复用项目自身的 D1 user.is_admin 字段
 *   （详见 .claude/project/confession-wall-auth.md）
 */
import { supabase } from './supabase'
import { functionsRequest } from './functionsRequest'

export interface ConfessionGroup {
  id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
  description: string | null
  sort_order: number
  is_default: boolean
  created_at: string
}

export interface ConfessionMessage {
  id: string
  group_id: string | null
  content: string
  mood: string | null
  color: string | null
  likes_count: number
  hugs_count: number
  created_at: string
}

export interface ReactionRecord {
  id: string
  message_id: string
  reaction_type: 'like' | 'hug'
  user_fingerprint: string
  created_at: string
}

const PAGE_SIZE = 20

export const confessionDb = {
  // ---------- 分组 ----------

  /**
   * 加载所有分组（按 sort_order 排序）
   */
  async getGroups(): Promise<ConfessionGroup[]> {
    const { data, error } = await supabase
      .from('confession_groups')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw error
    return (data || []) as ConfessionGroup[]
  },

  /**
   * 获取默认分组
   */
  async getDefaultGroup(): Promise<ConfessionGroup | null> {
    const { data, error } = await supabase
      .from('confession_groups')
      .select('*')
      .eq('is_default', true)
      .maybeSingle()
    if (error) throw error
    return (data as ConfessionGroup) || null
  },

  /**
   * 创建新分组（经 Cloudflare Function，需登录 + is_admin=1）
   */
  async createGroup(payload: {
    name: string
    icon?: string
    color?: string
    description?: string
  }): Promise<ConfessionGroup> {
    const resp = await functionsRequest.post('/api/confession/groups/create', {
      name: payload.name,
      icon: payload.icon,
      color: payload.color,
      description: payload.description,
    })
    if (!resp.data?.ok) {
      throw new Error(resp.data?.error || '创建分组失败')
    }
    return resp.data.group as ConfessionGroup
  },

  /**
   * 删除分组（经 Cloudflare Function，需登录 + is_admin=1；会级联删除所有告白）
   */
  async deleteGroup(groupId: string): Promise<void> {
    const resp = await functionsRequest.delete(
      `/api/confession/groups/delete?id=${encodeURIComponent(groupId)}`
    )
    if (!resp.data?.ok) {
      throw new Error(resp.data?.error || '删除分组失败')
    }
  },

  /**
   * 删除任意告白（经 Cloudflare Function，需登录 + is_admin=1；
   * 会级联删除该告白的所有 reactions）
   */
  async deleteMessage(messageId: string): Promise<void> {
    const resp = await functionsRequest.delete(
      `/api/confession/messages/delete?id=${encodeURIComponent(messageId)}`
    )
    if (!resp.data?.ok) {
      throw new Error(resp.data?.error || '删除告白失败')
    }
  },

  /**
   * 订阅分组列表变化（实时同步新增/删除的分组）
   */
  subscribeGroups(callback: () => void) {
    return supabase
      .channel('confession-groups-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'confession_groups' },
        () => callback()
      )
      .subscribe()
  },

  // ---------- 消息 ----------

  /**
   * 发布一条匿名告白
   */
  async sendMessage(payload: {
    content: string
    mood: string
    color: string
    group_id: string | null
  }) {
    const { data, error } = await supabase
      .from('confession_messages')
      .insert({
        group_id: payload.group_id,
        content: payload.content,
        mood: payload.mood,
        color: payload.color,
        likes_count: 0,
        hugs_count: 0,
      })
      .select()
      .single()
    if (error) throw error
    return data as ConfessionMessage
  },

  /**
   * 获取告白列表（按时间倒序，可选 hot 模式按点赞+抱抱总数排序）
   * groupId 为 null 表示拉取所有分组
   */
  async getMessages(
    sortMode: 'latest' | 'hot' = 'latest',
    before?: string,
    groupId?: string | null
  ) {
    let query = supabase
      .from('confession_messages')
      .select('*')
      .limit(PAGE_SIZE)

    if (groupId) {
      query = query.eq('group_id', groupId)
    }

    if (sortMode === 'hot') {
      query = query
        .order('likes_count', { ascending: false })
        .order('hugs_count', { ascending: false })
        .order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as ConfessionMessage[]
  },

  /**
   * 获取总数（可按分组过滤）
   */
  async getTotalCount(groupId?: string | null) {
    let query = supabase
      .from('confession_messages')
      .select('id', { count: 'exact', head: true })
    if (groupId) {
      query = query.eq('group_id', groupId)
    }
    const { count, error } = await query
    if (error) throw error
    return count || 0
  },

  // ---------- 反应 ----------

  /**
   * 切换反应：未点过则 insert，已点过则 delete（toggle 行为）
   * 同时同步消息上的 likes_count / hugs_count 冗余字段
   */
  async toggleReaction(
    messageId: string,
    reactionType: 'like' | 'hug',
    userFingerprint: string
  ) {
    const { data: existing, error: queryErr } = await supabase
      .from('confession_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('reaction_type', reactionType)
      .eq('user_fingerprint', userFingerprint)
      .maybeSingle()

    if (queryErr) throw queryErr

    const column = reactionType === 'like' ? 'likes_count' : 'hugs_count'

    if (existing) {
      const { error: delErr } = await supabase
        .from('confession_reactions')
        .delete()
        .eq('id', existing.id)
      if (delErr) throw delErr

      const { data: msg, error: getErr } = await supabase
        .from('confession_messages')
        .select('likes_count, hugs_count')
        .eq('id', messageId)
        .single()
      if (getErr) throw getErr
      const currentVal = (msg as any)[column] || 0
      const { error: updErr } = await supabase
        .from('confession_messages')
        .update({ [column]: Math.max(0, currentVal - 1) })
        .eq('id', messageId)
      if (updErr) throw updErr
      return { reacted: false }
    } else {
      const { error: insErr } = await supabase
        .from('confession_reactions')
        .insert({
          message_id: messageId,
          reaction_type: reactionType,
          user_fingerprint: userFingerprint,
        })
      if (insErr) throw insErr

      const { data: msg, error: getErr } = await supabase
        .from('confession_messages')
        .select('likes_count, hugs_count')
        .eq('id', messageId)
        .single()
      if (getErr) throw getErr
      const currentVal = (msg as any)[column] || 0
      const { error: updErr } = await supabase
        .from('confession_messages')
        .update({ [column]: currentVal + 1 })
        .eq('id', messageId)
      if (updErr) throw updErr
      return { reacted: true }
    }
  },

  /**
   * 获取当前用户对哪些消息已点过赞/抱抱（用于初始状态渲染）
   */
  async getUserReactions(userFingerprint: string): Promise<Record<string, Set<'like' | 'hug'>>> {
    const { data, error } = await supabase
      .from('confession_reactions')
      .select('message_id, reaction_type')
      .eq('user_fingerprint', userFingerprint)
    if (error) throw error
    const result: Record<string, Set<'like' | 'hug'>> = {}
    ;(data || []).forEach((r: any) => {
      if (!result[r.message_id]) result[r.message_id] = new Set()
      result[r.message_id].add(r.reaction_type)
    })
    return result
  },

  // ---------- 实时订阅 ----------

  /**
   * 订阅新告白（实时飘字，可选按分组过滤）
   */
  subscribeNewMessages(
    callback: (msg: ConfessionMessage) => void,
    groupId?: string | null
  ) {
    const filter = groupId ? { filter: `group_id=eq.${groupId}` } : {}
    return supabase
      .channel('confession-new-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'confession_messages',
          ...filter,
        },
        (payload) => {
          callback(payload.new as ConfessionMessage)
        }
      )
      .subscribe()
  },

  /**
   * 订阅告白删除事件（管理员删除时其他客户端自动更新）
   * groupId 过滤：仅当前分组内的删除事件回调，前端无需额外判断
   */
  subscribeMessageDeletes(
    callback: (messageId: string) => void,
    groupId?: string | null
  ) {
    const filter = groupId ? { filter: `group_id=eq.${groupId}` } : {}
    return supabase
      .channel('confession-message-deletes')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'confession_messages',
          ...filter,
        },
        (payload) => {
          callback((payload.old as ConfessionMessage).id)
        }
      )
      .subscribe()
  },

  /**
   * 订阅反应数变化（点赞/抱抱）
   */
  subscribeReactions(callback: (msgId: string, type: 'like' | 'hug', delta: number) => void) {
    return supabase
      .channel('confession-reactions')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'confession_messages',
        },
        (payload) => {
          const oldRow = payload.old as any
          const newRow = payload.new as any
          if (oldRow.likes_count !== newRow.likes_count) {
            callback(newRow.id, 'like', newRow.likes_count - oldRow.likes_count)
          }
          if (oldRow.hugs_count !== newRow.hugs_count) {
            callback(newRow.id, 'hug', newRow.hugs_count - oldRow.hugs_count)
          }
        }
      )
      .subscribe()
  },

  /**
   * 在线人数（使用 Presence，不依赖数据库）
   */
  subscribePresence(callbacks: {
    onSync: (count: number) => void
    onJoin?: () => void
    onLeave?: () => void
  }) {
    const channel = supabase.channel('confession-presence', {
      config: { presence: { key: '' } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        callbacks.onSync(Object.keys(state).length)
      })
      .on('presence', { event: 'join' }, () => callbacks.onJoin?.())
      .on('presence', { event: 'leave' }, () => callbacks.onLeave?.())
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ online_at: new Date().toISOString() })
        }
      })

    return channel
  },

  // ---------- 工具 ----------

  /**
   * 清理旧消息（用于超出免费额度时手动清理）
   */
  async cleanOldMessages(daysOld = 30) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('confession_messages')
      .delete()
      .lt('created_at', cutoff)
    if (error) throw error
  },
}

export default confessionDb