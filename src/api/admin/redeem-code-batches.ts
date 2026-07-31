// Admin 兑换码批次 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination } from '@/types/admin'

/** 批次摘要（含聚合统计） */
export interface RedeemCodeBatchRow {
  batch_id: string
  note: string | null
  credits: number
  expires_at: string | null
  created_at: string
  created_by: string | null
  total: number
  used: number
}

/** 批次详情（含全部 codes） */
export interface RedeemCodeBatchDetail {
  batch_id: string
  note: string | null
  credits: number
  expires_at: string | null
  created_at: string
  created_by: string | null
  total: number
  used: number
  codes: string[]
}

export interface ListRedeemCodeBatchesParams {
  page?: number
  pageSize?: number
  /** 模糊匹配：note / batch_id 前缀 */
  keyword?: string
}

export interface ListRedeemCodeBatchesResult {
  list: RedeemCodeBatchRow[]
  pagination: AdminPagination
}

/** 分页拉取批次列表 */
export async function fetchRedeemCodeBatches(
  params: ListRedeemCodeBatchesParams = {},
): Promise<ListRedeemCodeBatchesResult> {
  const res = await functionsRequest.get('/api/admin/redeem-code-batches', {
    params,
  })
  return res.data.data
}

/** 拉取单批次详情 + 全部 codes */
export async function fetchRedeemCodeBatch(
  batchId: string,
): Promise<RedeemCodeBatchDetail> {
  const res = await functionsRequest.get(`/api/admin/redeem-code-batches/${batchId}`)
  return res.data.data
}

/** 更新批次备注（同时作用于该 batch_id 下所有码） */
export async function updateRedeemCodeBatch(
  batchId: string,
  payload: { note?: string | null },
): Promise<void> {
  await functionsRequest.put(`/api/admin/redeem-code-batches/${batchId}`, payload)
}