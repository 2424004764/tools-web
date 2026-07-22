// Admin 全局积分流水 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination, CreditTransaction } from '@/types/admin'

export interface GlobalTxParams {
  page?: number
  pageSize?: number
  type?: '' | 'grant' | 'deduct' | 'reverse'
  keyword?: string
  operatorUid?: string
}

export async function fetchGlobalCreditTransactions(
  params: GlobalTxParams = {},
): Promise<{ list: CreditTransaction[]; pagination: AdminPagination }> {
  const res = await functionsRequest.get('/api/admin/credits/transactions', {
    params,
  })
  return res.data.data
}