// Admin 工具开关 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type {
  AdminPagination,
  ToolFeature,
  ToolCategorySummary,
} from '@/types/admin'

export interface AdminToolListParams {
  page?: number
  pageSize?: number
  categoryId?: number | ''
  enabled?: '' | '0' | '1'
  keyword?: string
}

export interface AdminToolListResult {
  list: ToolFeature[]
  categories: ToolCategorySummary[]
  pagination: AdminPagination
}

export async function fetchAdminTools(
  params: AdminToolListParams = {},
): Promise<AdminToolListResult> {
  const res = await functionsRequest.get('/api/admin/tools', { params })
  return res.data.data
}

export async function updateAdminTool(
  id: string,
  payload: Partial<{
    is_enabled: 0 | 1 | boolean
    sort_order: number
    description: string
    title: string
    logo: string
    credit_cost: number
  }>,
): Promise<ToolFeature> {
  const res = await functionsRequest.put(`/api/admin/tools/${id}`, payload)
  return res.data.data
}

export async function batchToggleTools(
  ids: string[],
  isEnabled: boolean,
): Promise<{ updated: number; is_enabled: number }> {
  const res = await functionsRequest.post('/api/admin/tools/batch-toggle', {
    ids,
    is_enabled: isEnabled ? 1 : 0,
  })
  return res.data.data
}