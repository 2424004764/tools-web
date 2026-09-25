// 我的 AI 创作（私有，按 uid 隔离）API 客户端
// 后端：
//   functions/api/ai-creations/[[path]].js
//     GET /api/ai-creations              当前 uid 的创作组（含每组图片）
//     GET /api/ai-creations/categories   当前 uid 出现的分类聚合
//
// 所有请求都强制要求登录（后端 uid 校验），未登录返回 401。
// 写入侧（图片入库）由 /ai-image-edit/ 等工具或手动上传组件完成。

import { functionsRequest } from '@/utils/functionsRequest'

export interface AiCreationImage {
  id: number
  media_url: string
  thumbnail_url: string | null
  filename: string
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
  source_type: 'ai_generated' | 'manual_upload'
  category: string | null
  model_name: string | null
  title: string | null
  /** 标签（AI 生成 / 手动上传通用），默认空数组 = 未打标签 */
  tags: string[]
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

/** 标签聚合项（当前 uid 所有合集出现过的标签 + 计数） */
export interface AiCreationTag {
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
  /** 关键词搜索（标题 / 模型 / 分类 / 标签 / 图片提示词 / 关联提示词内容） */
  q?: string
  /** 只看收藏 */
  favOnly?: boolean
  /** 来源筛选 */
  source?: 'ai_generated' | 'manual_upload'
  /** 按标签精确筛选 */
  tag?: string
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

export async function fetchAiCreationTags(): Promise<AiCreationTag[]> {
  const res = await functionsRequest.get('/api/ai-creations/tags')
  return res.data.data || []
}

// ============ 标签输入归一化（与后端 _lib/ai-creation-tags.js 约定一致）============
export const MAX_CREATION_TAGS = 10
export const MAX_CREATION_TAG_LEN = 24

/** 把用户输入（数组或逗号分隔字符串）拆成去重、截断后的标签数组 */
export function parseTagInput(input: string | string[] | null | undefined): string[] {
  if (input == null) return []
  const raw = Array.isArray(input) ? input : String(input).split(/[,，]/)
  const out: string[] = []
  for (const item of raw) {
    const tag = String(item ?? '')
      .trim()
      .replace(/^#+/, '')
      .replace(/\s+/g, ' ')
      .slice(0, MAX_CREATION_TAG_LEN)
    if (tag && !out.includes(tag)) out.push(tag)
    if (out.length >= MAX_CREATION_TAGS) break
  }
  return out
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
  scene: 'ai-image-edit' | 'ai-outfit' | 'manual-upload'
  category?: string
  model_name?: string
  title?: string
  /** 来源类型 */
  source_type?: 'ai_generated' | 'manual_upload'
  /** 可选标签（随合集保存；默认不传 = 空） */
  tags?: string[]
  images: Array<{
    upstream_url?: string
    prompt: string
    filename?: string
    width?: number
    height?: number
    content_type?: string
    /** 文件大小（字节）：后端据此预留存储额度，confirm 时按 R2 真实大小结算 */
    file_size?: number
  }>
}

export interface InitSaveResponse {
  group_id: number
  /** 存储额度预留 id（init 预扣了 declaredBytes 时返回）；confirm 时回传 */
  reservation_id?: string
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
  /** init 返回的存储额度预留 id（按 R2 真实大小结算并释放） */
  reservation_id?: string
  images: Array<{
    r2_key: string
    public_url?: string
    prompt: string
    width?: number
    height?: number
    file_size?: number
    filename?: string
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

// ============ 收藏 / 星标 / 标签 ============
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

/** 更新合集标签（tags 列由 081 迁移提供）；传空数组 = 清空标签 */
export async function updateAiCreationGroupTags(
  groupId: number,
  tags: string[],
): Promise<{ group_id: number; tags: string[] }> {
  const res = await functionsRequest.patch(`/api/ai-creations/groups/${groupId}`, { tags })
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

// ============ 手动上传（本地图片 → 我的创作）============
export interface ManualUploadFile {
  file: File
  filename?: string
  width?: number
  height?: number
}

export interface ManualUploadOptions {
  title?: string
  category?: string
  /** 可选标签；默认不打（空） */
  tags?: string[]
}

export interface ManualUploadResult {
  group_id: number
  inserted: number
  ids: number[]
}

/**
 * 使用 init → R2 PUT → confirm 流程保存本地图片。
 * filename 由调用方传入，适合在上传前让用户编辑名称。
 */
export async function saveManualAiCreationFiles(
  files: ManualUploadFile[],
  options: ManualUploadOptions = {},
): Promise<ManualUploadResult> {
  if (files.length === 0) throw new Error('至少选择一张图片')
  const init = await initAiCreationSave({
    scene: 'manual-upload',
    source_type: 'manual_upload',
    title: options.title,
    category: options.category,
    ...(options.tags?.length ? { tags: options.tags } : {}),
    images: files.map(({ file, filename, width, height }) => ({
      prompt: '(手动上传)',
      filename: filename || file.name,
      width,
      height,
      content_type: file.type || 'image/png',
      file_size: file.size,
    })),
  })

  await Promise.all(init.plan.map(async (plan) => {
    const item = files[plan.index]
    if (!item) throw new Error(`上传计划缺少第 ${plan.index + 1} 张图片`)
    await uploadImageBlobToR2(plan.upload_url, item.file, plan.content_type)
  }))

  const confirmed = await confirmAiCreationSave({
    group_id: init.group_id,
    reservation_id: init.reservation_id,
    images: init.plan.map((plan) => {
      const item = files[plan.index]
      return {
        r2_key: plan.r2_key,
        public_url: plan.public_url || undefined,
        prompt: '(手动上传)',
        width: item.width,
        height: item.height,
        file_size: item.file.size,
        filename: item.filename || item.file.name,
      }
    }),
  })
  return { group_id: init.group_id, ...confirmed }
}
