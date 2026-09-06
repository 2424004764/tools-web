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
  favorited: boolean
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
  /** 关键词搜索（标题 / 模型 / 分类 / 图片提示词 / 关联提示词内容） */
  q?: string
  /** 只看收藏 */
  favOnly?: boolean
}

export async function fetchAiCreations(
  params: ListAiCreationsParams = {},
): Promise<{ groups: AiCreationGroup[]; pagination: GroupPagination }> {
  const { favOnly, ...rest } = params
  const res = await functionsRequest.get('/api/ai-creations', {
    params: { ...rest, ...(favOnly ? { fav: 1 } : {}) },
  })
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

// ============ 收藏 / 星标 ============
/** 切换合集收藏状态（favorited 列由 073 迁移提供） */
export async function toggleAiCreationGroupFavorite(
  groupId: number,
  favorited: boolean,
): Promise<{ group_id: number; favorited: boolean }> {
  const res = await functionsRequest.patch(`/api/ai-creations/groups/${groupId}`, {
    favorited: favorited ? 1 : 0,
  })
  return res.data.data
}

// ============ 批量删除 ============
export interface BatchDeleteGroupsResponse {
  groups_deleted: number
  images: number
  r2_deleted: number
  r2_failed: number
  skipped_ids: number[]
}

/** 批量删除整组（一次最多 50 个）；不存在的 id / 越权 id 会进 skipped_ids */
export async function batchDeleteAiCreationGroups(
  ids: number[],
): Promise<BatchDeleteGroupsResponse> {
  const res = await functionsRequest.post('/api/ai-creations/groups/batch-delete', { ids })
  return res.data.data
}

// ============ 「认领」记录（用户声明某图已发布到某平台）============
// 预设平台写死在代码里（按用户决定）；用户可以在弹窗里输入自定义平台名（不入库平台库）

/** 系统预设平台列表（在认领弹窗里以 checkbox 形式给出） */
export const PRESET_PLATFORMS = ['小红书', '微博', '公众号', '视频号'] as const

export type PresetPlatform = (typeof PRESET_PLATFORMS)[number]

/** 单条认领记录 */
export interface ImageClaim {
  id: number
  image_id: number
  platform: string
  created_at: string
}

/** 批量拉一批图的认领（避免每张图单独请求） */
export async function fetchImageClaims(imageIds: number[]): Promise<ImageClaim[]> {
  if (!imageIds || imageIds.length === 0) return []
  const res = await functionsRequest.get('/api/ai-creations/claims', {
    params: { imageIds: imageIds.join(',') },
  })
  return (res.data?.data as ImageClaim[]) || []
}

/** 单条认领（重复认领同一平台幂等） */
export async function claimImage(
  imageId: number,
  platform: string,
): Promise<{ image_id: number; platform: string; created: boolean }> {
  const res = await functionsRequest.post('/api/ai-creations/claims', {
    image_id: imageId,
    platform,
  })
  return res.data.data
}

/** 取消单个认领 */
export async function unclaimImage(
  imageId: number,
  platform: string,
): Promise<{ image_id: number; platform: string; deleted: boolean }> {
  const res = await functionsRequest.delete('/api/ai-creations/claims', {
    params: { image_id: imageId, platform },
  })
  return res.data.data
}

/** 删除某张图的所有认领（图被删除时调用）
 *  后端会无视外键直接 DELETE FROM ai_creation_claims WHERE image_id = ? AND uid = ? */
export async function unclaimByImage(
  imageId: number,
): Promise<{ image_id: number; deleted: number }> {
  const res = await functionsRequest.delete('/api/ai-creations/claims', {
    params: { image_id: imageId },
  })
  return res.data.data
}

/** 批量删除多张图的所有认领（删除整组时调用，一次 SQL 删干净） */
export async function unclaimByImages(
  imageIds: number[],
): Promise<{ deleted: number }> {
  if (!imageIds || imageIds.length === 0) return { deleted: 0 }
  const res = await functionsRequest.delete('/api/ai-creations/claims', {
    params: { image_ids: imageIds.join(',') },
  })
  return res.data.data
}