// 当前用户相关 API
import { functionsRequest } from '@/utils/functionsRequest'
import type { GenerationRecord } from '@/types/admin'

export interface MyCredits {
  balance: number
  total_earned: number
  total_spent: number
  updated_at: string | null
}

export interface CreditTransaction {
  id: string
  type: 'grant' | 'deduct' | 'reverse'
  amount: number
  balance_after: number
  reason: string | null
  /** 流水来源：迁移前的老数据为 null（前端展示为"未知"） */
  source: 'system' | 'admin' | 'tool' | null
  related_tx_id: string | null
  created_at: string
  /** 后端通过 reason 前缀推断 + LEFT JOIN tool_features 得出 */
  tool_url: string | null
  tool_title: string | null
}

export interface MyCreditsPagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export async function fetchMyCredits(): Promise<MyCredits> {
  const res = await functionsRequest.get('/api/me/credits')
  // 后端返回 { ok, balance, total_earned, total_spent, updated_at }
  return {
    balance: res.data?.balance ?? 0,
    total_earned: res.data?.total_earned ?? 0,
    total_spent: res.data?.total_spent ?? 0,
    updated_at: res.data?.updated_at ?? null,
  }
}

export async function fetchMyTransactions(
  page = 1,
  pageSize = 20,
): Promise<{ list: CreditTransaction[]; pagination: MyCreditsPagination }> {
  const res = await functionsRequest.get('/api/me/credits/transactions', {
    params: { page, pageSize },
  })
  return {
    list: (res.data?.list as CreditTransaction[]) || [],
    pagination: res.data?.pagination || {
      total: 0, page, pageSize, totalPages: 0, hasNext: false, hasPrev: false,
    },
  }
}

/**
 * 当前用户的 AI 生成历史
 * @param status '' 表示不过滤
 */
export async function fetchMyGenerationRecords(
  page = 1,
  pageSize = 10,
  status: '' | 'in_progress' | 'success' | 'failed' | 'timeout' | 'reversed' = '',
  keyword = '',
): Promise<{ list: GenerationRecord[]; pagination: MyCreditsPagination }> {
  const res = await functionsRequest.get('/api/me/generation-records', {
    params: {
      page,
      pageSize,
      status: status || undefined,
      keyword: keyword || undefined,
    },
  })
  return {
    list: (res.data?.list as GenerationRecord[]) || [],
    pagination: res.data?.pagination || {
      total: 0, page, pageSize, totalPages: 0, hasNext: false, hasPrev: false,
    },
  }
}

