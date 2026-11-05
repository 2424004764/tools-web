// 后台管理 - 工具使用记录 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type {
  AdminPagination,
  ToolUsageRecord,
  ToolUsageStats,
  ToolUsageListParams,
  SourceBlacklistItem,
} from '@/types/admin'

export type { ToolUsageRecord, ToolUsageStats, ToolUsageListParams, SourceBlacklistItem }

/**
 * 拉取工具使用明细列表（带分页与筛选）
 */
export async function fetchToolUsageRecords(
  params: ToolUsageListParams = {},
): Promise<{ list: ToolUsageRecord[]; pagination: AdminPagination }> {
  const res = await functionsRequest.get('/api/admin/tool-usage', { params })
  return res.data.data
}

/**
 * 拉取工具使用聚合统计
 * @param params.startDate 可选（YYYY-MM-DD，UTC+8）：仅作用于来源统计与被屏蔽次数
 * @param params.endDate   可选（YYYY-MM-DD，含当天）
 */
export async function fetchToolUsageStats(
  params: { startDate?: string; endDate?: string } = {},
): Promise<ToolUsageStats> {
  const res = await functionsRequest.get('/api/admin/tool-usage/stats', { params })
  return res.data.data
}

/**
 * 拉取来源黑名单列表
 */
export async function fetchSourceBlacklist(): Promise<SourceBlacklistItem[]> {
  const res = await functionsRequest.get('/api/admin/tool-usage/source-blacklist')
  return res.data.data.list
}

/**
 * 批量拉黑来源（后端规范化并去重；direct 不可拉黑）
 */
export async function addSourceBlacklist(
  sources: string[],
  reason?: string,
): Promise<{ added: string[] }> {
  const res = await functionsRequest.post('/api/admin/tool-usage/source-blacklist', {
    sources,
    reason,
  })
  return res.data.data
}

/**
 * 批量移除黑名单来源（解禁，统计与明细即时恢复计入）
 */
export async function removeSourceBlacklist(
  sources: string[],
): Promise<{ removed: number }> {
  const res = await functionsRequest.delete('/api/admin/tool-usage/source-blacklist', {
    data: { sources },
  })
  return res.data.data
}