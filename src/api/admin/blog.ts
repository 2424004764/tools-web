import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination } from '@/types/admin'
import type { BlogAuthorType } from '@/api/blog'

export type AdminBlogPostStatus = 'draft' | 'pending' | 'published' | 'rejected'

/** 文章项（管理视图，列表不含正文） */
export interface AdminBlogPost {
  id: string
  slug: string
  title: string
  summary: string
  cover: string
  tags: string
  related_tools: string
  author_id: string | null
  author_name: string
  author_avatar: string
  author_type: BlogAuthorType
  status: AdminBlogPostStatus
  views: number
  reject_reason: string
  reviewed_by: string | null
  reviewed_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  /** 仅详情返回（创建/更新接口返回值带） */
  content?: string
}

export interface AdminBlogPostCounts {
  pending: number
  draft: number
  published: number
  rejected: number
  total: number
}

export interface AdminBlogPostListParams {
  page?: number
  pageSize?: number
  status?: AdminBlogPostStatus | ''
  keyword?: string
}

export async function fetchAdminBlogPosts(
  params: AdminBlogPostListParams = {},
): Promise<{ list: AdminBlogPost[]; pagination: AdminPagination; counts: AdminBlogPostCounts }> {
  const res = await functionsRequest.get('/api/admin/blog/posts', { params })
  return res.data.data
}

export interface AdminBlogPostCreatePayload {
  title: string
  content: string
  summary?: string
  cover?: string
  tags?: string
  related_tools?: string
  slug?: string
  /** draft = 存草稿，published = 直接发布（默认） */
  status?: 'draft' | 'published'
}

/** 单篇文章详情（编辑回填，含正文） */
export async function fetchAdminBlogPost(id: string): Promise<AdminBlogPost> {
  const res = await functionsRequest.get(`/api/admin/blog/posts/${encodeURIComponent(id)}`)
  return res.data.data
}

export async function createAdminBlogPost(payload: AdminBlogPostCreatePayload): Promise<AdminBlogPost> {
  const res = await functionsRequest.post('/api/admin/blog/posts', payload)
  return res.data.data
}

export interface AdminBlogPostUpdatePayload {
  title?: string
  content?: string
  summary?: string
  cover?: string
  tags?: string
  related_tools?: string
  slug?: string
  status?: AdminBlogPostStatus
  /** 驳回理由（status = rejected 时生效） */
  reject_reason?: string
}

/** 更新/审核文章：内容字段任选；status 审核语义见后端注释 */
export async function updateAdminBlogPost(
  id: string,
  payload: AdminBlogPostUpdatePayload,
): Promise<AdminBlogPost> {
  const res = await functionsRequest.put(`/api/admin/blog/posts/${encodeURIComponent(id)}`, payload)
  return res.data.data
}

export async function deleteAdminBlogPost(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await functionsRequest.delete(`/api/admin/blog/posts/${encodeURIComponent(id)}`)
  return res.data.data
}
