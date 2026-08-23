// 后台管理 - 工具使用记录 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type {
  AdminPagination,
  ToolUsageRecord,
  ToolUsageStats,
  ToolUsageListParams,
} from '@/types/admin'

export type { ToolUsageRecord, ToolUsageStats, ToolUsageListParams }

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
 */
export async function fetchToolUsageStats(): Promise<ToolUsageStats> {
  const res = await functionsRequest.get('/api/admin/tool-usage/stats')
  return res.data.data
}