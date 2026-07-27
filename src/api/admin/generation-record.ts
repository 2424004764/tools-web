// Admin 生成记录 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination, GenerationRecord } from '@/types/admin'

export interface GenerationRecordParams {
  page?: number
  pageSize?: number
  status?: '' | 'in_progress' | 'success' | 'failed' | 'timeout' | 'reversed'
  source?: string
  uid?: string
  keyword?: string
}

export async function fetchGenerationRecords(
  params: GenerationRecordParams = {},
): Promise<{ list: GenerationRecord[]; pagination: AdminPagination }> {
  const res = await functionsRequest.get('/api/admin/generation-records', {
    params,
  })
  return res.data.data
}

/**
 * 清理卡住的 in_progress 记录（created_at 早于阈值，标记为 failed）
 * @param olderThanMinutes 阈值（分钟），默认 15
 */
export async function cleanupStuckGenerationRecords(
  olderThanMinutes = 15,
): Promise<{ cleaned: number; thresholdMinutes: number }> {
  const res = await functionsRequest.post('/api/admin/generation-records/cleanup', {
    olderThanMinutes,
  })
  return res.data.data
}