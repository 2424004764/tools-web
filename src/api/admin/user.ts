// Admin 用户管理 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type {
  AdminPagination,
  AdminUser,
  AdminUserDetail,
  BatchAdjustCreditPayload,
  BatchAdjustCreditResult,
  BatchDeleteUsersResult,
  CreateUserPayload,
  CreateUserResult,
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

/** 手动创建用户 */
export async function createAdminUser(
  payload: CreateUserPayload,
): Promise<CreateUserResult> {
  const res = await functionsRequest.post('/api/admin/users', payload)
  return res.data.data
}

export async function fetchAdminUser(uid: string): Promise<AdminUserDetail> {
  const res = await functionsRequest.get(`/api/admin/users/${uid}`)
  return res.data.data
}

/** 永久删除用户（不可恢复，会级联清理全部子表） */
export async function deleteAdminUser(uid: string): Promise<void> {
  await functionsRequest.delete(`/api/admin/users/${uid}`)
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

export interface ResetUserPasswordResult {
  id: string
  updated: boolean
  /** 服务端生成的随机密码（仅管理员留空由后端生成时返回，只展示一次） */
  generated_password?: string
}

/**
 * 重置用户密码（仅限邮箱+密码注册的用户）
 * - password 留空时由后端生成 10 位随机密码并在返回体中返回一次
 * - 第三方登录（Google 等）用户没有密码，后端会直接拒绝
 */
export async function resetAdminUserPassword(
  uid: string,
  password?: string,
): Promise<ResetUserPasswordResult> {
  const res = await functionsRequest.put(`/api/admin/users/${uid}/password`, {
    password: password || '',
  })
  return res.data.data
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

export interface AdjustStoragePayload {
  type: 'grant' | 'deduct'
  /** 调整量，单位 MB（1024 MB = 1 GB） */
  mb: number
  reason?: string
}

export interface AdjustStorageResult {
  uid: string
  type: 'grant' | 'deduct'
  mb: number
  quotaBytesBefore: number
  quotaBytesAfter: number
  usedBytes: number
  /** true = 扣减后额度低于已用（已有文件保留，但剩余可用为 0） */
  overUsed: boolean
}

/**
 * 赠送/扣减用户存储额度（单位 MB）
 * - grant：额度累加，无额度记录也可直接赠送
 * - deduct：额度扣到 0 封底，允许低于已用
 */
export async function adjustUserStorage(
  uid: string,
  payload: AdjustStoragePayload,
): Promise<AdjustStorageResult> {
  const res = await functionsRequest.post(`/api/admin/users/${uid}/storage`, payload)
  return res.data.data
}

export interface ClearReservationsResult {
  uid: string
  /** 删除的预留行数 */
  deleted: number
  /** 清理前的预留总字节 */
  bytesBefore: number
  message?: string
}

/**
 * 清理用户全部上传预留（预扣）。
 * 用于预扣长期挂账（结算链路异常）时的手动修复；删除后预留占用的额度立即释放。
 */
export async function clearUserStorageReservations(
  uid: string,
): Promise<ClearReservationsResult> {
  const res = await functionsRequest.post(`/api/admin/users/${uid}/clear-reservations`)
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

/**
 * 批量永久删除用户（不可恢复，会级联清理全部子表）
 * - 必须显式传 uids，不支持全量模式
 * - 服务端自动跳过管理员账号与发起人自己（计入 skipped）
 */
export async function batchDeleteUsers(uids: string[]): Promise<BatchDeleteUsersResult> {
  const res = await functionsRequest.post('/api/admin/users/batch-delete', { uids })
  return res.data.data
}