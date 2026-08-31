// 我的 AI 创作（私有，按 uid 隔离）API 客户端
// 后端：
//   functions/api/ai-creations/[[path]].js
//     GET /api/ai-creations              当前 uid 的创作组（含每组图片）
//     GET /api/ai-creations/categories   当前 uid 出现的分类聚合
//
// 所有请求都强制要求登录（后端 uid 校验），未登录返回 401。
// 写入侧（图片入库）后续由 /ai-image-edit/ 等工具完成；本次仅做展示。

import { functionsRequest } from '@/utils/functionsRequest'

export interface AiCreationImage {
  id: number
  media_url: string
  thumbnail_url: string | null
  prompt: string
  width: number | null
  height: number | null
  created_at: string
}

export interface AiCreationGroup {
  id: number
  prompt_id: string | null
  prompt: { id: string; title: string | null; content: string } | null
  scene: string
  category: string | null
  model_name: string | null
  title: string | null
  created_at: string
  image_count: number
  cover: { id: number; media_url: string; thumbnail_url: string | null } | null
  images: AiCreationImage[]
}

export interface AiCreationCategory {
  name: string
  count: number
}

export interface GroupPagination {
  total: number
  /** 当前 uid 全部组的图片总数（含筛选条件下） */
  totalImages: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ListAiCreationsParams {
  page?: number
  pageSize?: number
  category?: string
}

export async function fetchAiCreations(
  params: ListAiCreationsParams = {},
): Promise<{ groups: AiCreationGroup[]; pagination: GroupPagination }> {
  const res = await functionsRequest.get('/api/ai-creations', { params })
  return res.data.data
}

export async function fetchAiCreationCategories(): Promise<AiCreationCategory[]> {
  const res = await functionsRequest.get('/api/ai-creations/categories')
  return res.data.data || []
}