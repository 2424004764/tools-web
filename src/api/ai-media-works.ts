// AI 媒体作品 API 客户端（前端）
import { functionsRequest } from '@/utils/functionsRequest'

export interface AiMediaWork {
  id: number
  media_type: 'image' | 'video'
  media_url: string
  thumbnail_url: string | null
  prompt: string
  category: string
  model_name: string | null
  source_name: string | null
  source_url?: string | null
  width: number | null
  height: number | null
  duration: number | null
  file_size?: number | null
  tags?: string | null
  audit_status?: 'approved' | 'pending' | 'rejected'
  view_count: number
  created_at: string
  updated_at?: string
}

export interface AiMediaCategory {
  name: string
  count: number
}

export interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ListAiMediaParams {
  page?: number
  pageSize?: number
  category?: string
  type?: 'image' | 'video'
}

export interface AdminListAiMediaParams extends ListAiMediaParams {
  audit_status?: 'approved' | 'pending' | 'rejected'
  keyword?: string
}

// 公开列表
export async function fetchAiMediaWorks(
  params: ListAiMediaParams = {},
): Promise<{ list: AiMediaWork[]; pagination: Pagination }> {
  const res = await functionsRequest.get('/api/ai-media-works', { params })
  return res.data.data
}

// 公开详情
export async function fetchAiMediaWork(id: number): Promise<AiMediaWork> {
  const res = await functionsRequest.get(`/api/ai-media-works/${id}`)
  return res.data.data
}

// 公开分类聚合
export async function fetchAiMediaCategories(): Promise<AiMediaCategory[]> {
  const res = await functionsRequest.get('/api/ai-media-works/categories')
  return res.data.data || []
}

// 管理员列表
export async function fetchAdminAiMediaWorks(
  params: AdminListAiMediaParams = {},
): Promise<{ list: AiMediaWork[]; pagination: Pagination }> {
  const res = await functionsRequest.get('/api/admin/ai-media-works', { params })
  return res.data.data
}

// 管理员审核
export async function auditAiMediaWork(
  id: number,
  audit_status: 'approved' | 'pending' | 'rejected',
): Promise<{ id: number; audit_status: string }> {
  const res = await functionsRequest.put(`/api/admin/ai-media-works/${id}`, { audit_status })
  return res.data.data
}

// 管理员删除
export async function deleteAiMediaWork(id: number): Promise<{ id: number; deleted: boolean }> {
  const res = await functionsRequest.delete(`/api/admin/ai-media-works/${id}`)
  return res.data.data
}
