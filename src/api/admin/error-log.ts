import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination, ApiErrorLog, ApiErrorLogParams } from '@/types/admin'

/**
 * 分页查询 API 错误日志
 * GET /api/admin/error-logs
 */
export async function fetchApiErrorLogs(
  params: ApiErrorLogParams = {},
): Promise<{ list: ApiErrorLog[]; pagination: AdminPagination }> {
  const res = await functionsRequest.get('/api/admin/error-logs', { params })
  return res.data.data
}

/**
 * 标记 / 取消标记一条错误日志为已处理
 * PATCH /api/admin/error-logs/{id}
 */
export async function setApiErrorLogResolved(
  id: string,
  isResolved: 0 | 1,
  resolvedNote?: string,
): Promise<{ id: string; is_resolved: 0 | 1; resolved_at: string | null; resolved_note: string | null }> {
  const res = await functionsRequest.patch(`/api/admin/error-logs/${encodeURIComponent(id)}`, {
    is_resolved: isResolved,
    resolved_note: resolvedNote ?? null,
  })
  return res.data.data
}

/**
 * 清理 N 天前的旧日志
 * DELETE /api/admin/error-logs?days=30
 */
export async function cleanupApiErrorLogs(days = 30): Promise<{ deleted: number; cutoff: string; days: number }> {
  const res = await functionsRequest.delete('/api/admin/error-logs', { params: { days } })
  return res.data.data
}
