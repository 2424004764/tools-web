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
 * 获取单条生成记录详情（含 raw_data）。
 * 列表接口不返回 raw_data（内含上游响应/base64 图片，体积过大），详情按需取。
 */
export async function fetchGenerationRecordDetail(id: string): Promise<GenerationRecord> {
  const res = await functionsRequest.get(`/api/admin/generation-records/${id}`)
  return res.data.data
}

/**
 * 清理卡住的 in_progress 记录（created_at 早于阈值）。
 * 有扣费流水的自动退还积分并标记 reversed，无扣费的标记 failed。
 * @param olderThanMinutes 阈值（分钟），默认 15
 */
export async function cleanupStuckGenerationRecords(olderThanMinutes = 15): Promise<{
  cleaned: number
  refunded: number
  markedFailed: number
  thresholdMinutes: number
}> {
  const res = await functionsRequest.post('/api/admin/generation-records/cleanup', {
    olderThanMinutes,
  })
  return res.data.data
}