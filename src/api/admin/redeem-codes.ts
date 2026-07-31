// Admin 兑换码管理 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type {
  AdminPagination,
  GenerateRedeemCodesPayload,
  GenerateRedeemCodesResult,
  RedeemCode,
  RedeemCodeBatch,
} from '@/types/admin'

export interface ListRedeemCodesParams {
  page?: number
  pageSize?: number
  status?: '' | 'unused' | 'used' | 'expired'
  /** 按批次 ID 精确过滤 */
  batch?: string
  /** 模糊匹配：code 前缀 / 兑换人 email/username/uid */
  keyword?: string
}

export interface ListRedeemCodesResult {
  list: RedeemCode[]
  pagination: AdminPagination
  batches: RedeemCodeBatch[]
}

export async function fetchRedeemCodes(
  params: ListRedeemCodesParams = {},
): Promise<ListRedeemCodesResult> {
  const res = await functionsRequest.get('/api/admin/redeem-codes', { params })
  return res.data.data
}

export async function generateRedeemCodes(
  payload: GenerateRedeemCodesPayload,
): Promise<GenerateRedeemCodesResult> {
  const res = await functionsRequest.post('/api/admin/redeem-codes', payload)
  return res.data.data
}