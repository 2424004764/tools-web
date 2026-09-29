import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination } from '@/types/admin'

export type SiteCommentStatus = 'pending' | 'approved' | 'rejected'

/** 评论项（管理视图） */
export interface AdminComment {
  id: string
  page_path: string
  page_title: string | null
  content: string
  user_id: string | null
  nickname: string
  email: string
  avatar: string
  status: SiteCommentStatus
  submit_ip: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  /** 站长回复指向的原评论 id；用户评论为 null */
  parent_id: string | null
  /** 1 = 站长回复 */
  is_admin: number
  created_at: string
}

export interface AdminCommentCounts {
  pending: number
  approved: number
  rejected: number
  total: number
}

export interface AdminCommentListParams {
  page?: number
  pageSize?: number
  status?: SiteCommentStatus | ''
  keyword?: string
}

export async function fetchAdminComments(
  params: AdminCommentListParams = {},
): Promise<{ list: AdminComment[]; pagination: AdminPagination; counts: AdminCommentCounts }> {
  const res = await functionsRequest.get('/api/admin/comments', { params })
  return res.data.data
}

export async function updateAdminCommentStatus(
  id: string,
  status: SiteCommentStatus,
): Promise<AdminComment> {
  const res = await functionsRequest.put(`/api/admin/comments/${encodeURIComponent(id)}`, { status })
  return res.data.data
}

/**
 * 站长回复评论：回复直接公开可见；
 * 原评论还在待审时后端会顺带自动通过（返回的 parent.status 为 approved）
 */
export async function replyAdminComment(
  id: string,
  content: string,
): Promise<{ reply: AdminComment; parent: { id: string; status: SiteCommentStatus } }> {
  const res = await functionsRequest.post(`/api/admin/comments/${encodeURIComponent(id)}`, { content })
  return res.data.data
}

/** 批量改状态（通过/拒绝/撤回待审），返回实际更新条数 */
export async function batchUpdateAdminComments(
  ids: string[],
  status: SiteCommentStatus,
): Promise<{ ids: string[]; status: SiteCommentStatus; updated: number }> {
  const res = await functionsRequest.put('/api/admin/comments', { ids, status })
  return res.data.data
}

export async function deleteAdminComment(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await functionsRequest.delete(`/api/admin/comments/${encodeURIComponent(id)}`)
  return res.data.data
}
