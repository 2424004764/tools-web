// Admin 工具 model CRUD API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type { ToolModel } from '@/types/admin'

export async function fetchAdminToolModels(toolUrl: string): Promise<ToolModel[]> {
  const res = await functionsRequest.get('/api/admin/tool-models', { params: { toolUrl } })
  return res.data.data?.list || []
}

export interface CreateToolModelPayload {
  tool_url: string
  model_key: string
  model_label: string
  description?: string
  credit_cost: number
  sort_order?: number
  is_enabled?: 0 | 1 | boolean
  is_default?: 0 | 1 | boolean
}

export async function createAdminToolModel(payload: CreateToolModelPayload): Promise<ToolModel> {
  const res = await functionsRequest.post('/api/admin/tool-models', payload)
  return res.data.data
}

export type UpdateToolModelPayload = Partial<{
  model_label: string
  description: string
  credit_cost: number
  sort_order: number
  is_enabled: 0 | 1 | boolean
  is_default: 0 | 1 | boolean
}>

export async function updateAdminToolModel(
  id: number,
  payload: UpdateToolModelPayload,
): Promise<ToolModel> {
  const res = await functionsRequest.put(`/api/admin/tool-models/${id}`, payload)
  return res.data.data
}

export async function deleteAdminToolModel(id: number): Promise<{ id: number; deleted: number }> {
  const res = await functionsRequest.delete(`/api/admin/tool-models/${id}`)
  return res.data.data
}

export interface ReorderItem {
  id: number
  sort_order: number
}

/**
 * 批量重排 model 顺序（拖拽保存）。
 * 一次性提交所有 id+sort_order，原子写入。
 */
export async function batchReorderToolModels(items: ReorderItem[]): Promise<{ updated: number }> {
  const res = await functionsRequest.post('/api/admin/tool-models/batch-reorder', { items })
  return res.data.data
}
