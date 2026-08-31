import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination, SlowQueryLog, SlowQueryLogParams } from '@/types/admin'

/**
 * 分页查询慢查询日志
 * GET /api/admin/slow-query-logs
 *
 * 默认按 duration_ms DESC 排序，最慢的排前面，方便快速定位瓶颈。
 */
export async function fetchSlowQueryLogs(
  params: SlowQueryLogParams = {},
): Promise<{ list: SlowQueryLog[]; pagination: AdminPagination }> {
  const res = await functionsRequest.get('/api/admin/slow-query-logs', { params })
  return res.data.data
}

/**
 * 清理 N 天前的旧慢查询日志
 * DELETE /api/admin/slow-query-logs?days=30
 */
export async function cleanupSlowQueryLogs(days = 30): Promise<{ deleted: number; cutoff: string; days: number }> {
  const res = await functionsRequest.delete('/api/admin/slow-query-logs', { params: { days } })
  return res.data.data
}
