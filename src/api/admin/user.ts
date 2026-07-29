// Admin 用户管理 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type {
  AdminPagination,
  AdminUser,
  AdminUserDetail,
  BatchAdjustCreditPayload,
  BatchAdjustCreditResult,
  CreditTransaction,
} from '@/types/admin'

interface ListResult {
  list: AdminUser[]
  pagination: AdminPagination
}

export interface AdminUserListParams {
  page?: number
  pageSize?: number
  keyword?: string
  disabled?: '0' | '1' | ''
}

export async function fetchAdminUsers(
  params: AdminUserListParams = {},
): Promise<ListResult> {
  const res = await functionsRequest.get('/api/admin/users', { params })
  return res.data.data
}

export async function fetchAdminUser(uid: string): Promise<AdminUserDetail> {
  const res = await functionsRequest.get(`/api/admin/users/${uid}`)
  return res.data.data
}

export async function updateAdminUser(
  uid: string,
  payload: { username?: string; avatar?: string },
): Promise<void> {
  await functionsRequest.put(`/api/admin/users/${uid}`, payload)
}

export async function toggleAdminUserDisabled(
  uid: string,
  isDisabled: boolean,
  reason?: string,
): Promise<void> {
  await functionsRequest.post(`/api/admin/users/${uid}/toggle-disabled`, {
    is_disabled: isDisabled ? 1 : 0,
    reason: reason || '',
  })
}

export interface CreditLogsParams {
  page?: number
  pageSize?: number
  type?: '' | 'grant' | 'deduct' | 'reverse'
}

export async function fetchUserCreditLogs(
  uid: string,
  params: CreditLogsParams = {},
): Promise<{ list: CreditTransaction[]; pagination: AdminPagination }> {
  const res = await functionsRequest.get(
    `/api/admin/users/${uid}/credits-logs`,
    { params },
  )
  return res.data.data
}

export interface AdjustCreditPayload {
  type: 'grant' | 'deduct'
  amount: number
  reason?: string
}

export interface AdjustCreditResult {
  txId: string
  uid: string
  type: 'grant' | 'deduct'
  amount: number
  balanceBefore: number
  balanceAfter: number
  created_at: string
}

export async function adjustUserCredits(
  uid: string,
  payload: AdjustCreditPayload,
): Promise<AdjustCreditResult> {
  const res = await functionsRequest.post(`/api/admin/users/${uid}/credits`, payload)
  return res.data.data
}

/**
 * 批量调整积分
 * - 不传 uids / 传空数组 = 作用于所有非管理员用户（服务端自动排除管理员和发起人）
 * - 传 uids = 仅作用于列表中的用户（同样自动过滤管理员）
 */
export async function batchAdjustUserCredits(
  payload: BatchAdjustCreditPayload,
): Promise<BatchAdjustCreditResult> {
  const res = await functionsRequest.post(
    '/api/admin/users/credits/batch',
    payload,
  )
  return res.data.data
}