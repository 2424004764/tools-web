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
 * 清理 N 天前的旧日志
 * DELETE /api/admin/error-logs?days=30
 */
export async function cleanupApiErrorLogs(days = 30): Promise<{ deleted: number; cutoff: string; days: number }> {
  const res = await functionsRequest.delete('/api/admin/error-logs', { params: { days } })
  return res.data.data
}
