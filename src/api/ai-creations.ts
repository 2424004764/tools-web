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

// ============ 保存（生成结果 → 我的创作）============
// 单张图上传计划（init 返回的 plan 数组元素）
export interface SavePlanItem {
  index: number
  /** 浏览器 fetch PUT 这个 URL 把 blob 上传到 R2 */
  upload_url: string
  /** R2 对象键，用于 confirm 时回填 D1 */
  r2_key: string
  /** 签名锁定的 Content-Type，PUT 时必须一致 */
  content_type: string
  /** R2 公网 URL；R2_PUBLIC_HOST 未配置时为空字符串 */
  public_url: string
  /** 签名过期时间（ms） */
  expires_at: number
  /** 上游原 URL（前端用这个 fetch blob） */
  upstream_url: string
  prompt: string
  width: number | null
  height: number | null
}

export interface InitSaveRequest {
  /** 可选；来自 user_tool_prompts.id；非空时按 (uid, prompt_id) 复用 group */
  prompt_id?: string | null
  /** 来源场景，如 'ai-image-edit' */
  scene: 'ai-image-edit' | 'ai-outfit'
  category?: string
  model_name?: string
  title?: string
  images: Array<{
    upstream_url: string
    prompt: string
    width?: number
    height?: number
    content_type?: string
  }>
}

export interface InitSaveResponse {
  group_id: number
  plan: SavePlanItem[]
}

/** 第一步：调 init 获取 group_id + 每个图的上传 URL */
export async function initAiCreationSave(
  req: InitSaveRequest,
): Promise<InitSaveResponse> {
  const res = await functionsRequest.post('/api/ai-creations/save/init', req)
  return res.data.data
}

export interface ConfirmSaveRequest {
  group_id: number
  images: Array<{
    r2_key: string
    public_url?: string
    prompt: string
    width?: number
    height?: number
    file_size?: number
  }>
}

/** 第二步：上传完 R2 后调用，写入 D1 */
export async function confirmAiCreationSave(
  req: ConfirmSaveRequest,
): Promise<{ inserted: number; ids: number[] }> {
  const res = await functionsRequest.post('/api/ai-creations/save/confirm', req)
  return res.data.data
}

/**
 * 把 blob 上传到 R2 presigned URL。
 * 注意：uploadUrl 是 SigV4 签过的、绑定 content_type，PUT 时必须传同样的 Content-Type header。
 */
export async function uploadImageBlobToR2(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`R2 上传失败: HTTP ${res.status} ${text.slice(0, 200)}`)
  }
}

// ============ 删除 ============
export interface DeleteGroupResponse {
  group_id: number
  images: number
  r2_deleted: number
  r2_failed: number
}

export async function deleteAiCreationGroup(
  groupId: number,
): Promise<DeleteGroupResponse> {
  const res = await functionsRequest.delete(`/api/ai-creations/groups/${groupId}`)
  return res.data.data
}

export interface DeleteImageResponse {
  image_id: number
  group_id: number
  r2_deleted: boolean
  r2_failed: boolean
}

export async function deleteAiCreationImage(
  imageId: number,
): Promise<DeleteImageResponse> {
  const res = await functionsRequest.delete(`/api/ai-creations/images/${imageId}`)
  return res.data.data
}