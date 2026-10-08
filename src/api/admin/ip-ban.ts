// 后台管理 - IP 封禁规则 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type { IpBanRule } from '@/types/admin'

export type { IpBanRule }

/**
 * 拉取生效中的封禁规则列表（后端顺带清理已过期行）
 */
export async function fetchIpBans(): Promise<IpBanRule[]> {
  const res = await functionsRequest.get('/api/admin/ip-bans')
  return res.data.data.list
}

export interface CreateIpBanPayload {
  ip: string
  reason?: string
  /** 封禁时长（小时）；0 = 永久 */
  duration_hours?: number
}

/**
 * 新增封禁（IPv6 自动按 /64 网段封禁；重复封同一对象会覆盖原因/时长）
 */
export async function createIpBan(payload: CreateIpBanPayload): Promise<IpBanRule> {
  const res = await functionsRequest.post('/api/admin/ip-bans', payload)
  return res.data.data.rule
}

/**
 * 解封（按规则 id）
 */
export async function deleteIpBan(id: string): Promise<void> {
  await functionsRequest.delete(`/api/admin/ip-bans/${encodeURIComponent(id)}`)
}
