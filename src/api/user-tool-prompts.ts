// 用户级提示词库 API 封装
// 后端：
//   functions/api/user-tool-prompts.js          提示词 CRUD（支持 group_id 过滤 / 移动）
//   functions/api/user-tool-prompt-groups.js    分组 CRUD
//
// 场景（scene）取值：'ai-image-edit' / 'ai-outfit'。新增工具时同步后端 ALLOWED_SCENES。
// 所有请求都强制要求登录（后端 uid 校验），前端 axios 拦截器会自动带 Bearer token。

import { functionsRequest } from '@/utils/functionsRequest'

/** 支持的场景标识。新增工具时同时改这里和后端 ALLOWED_SCENES。 */
export type PromptScene = 'ai-image-edit' | 'ai-outfit'

/** 提示词分组（用户级；按 scene 隔离） */
export interface UserToolPromptGroup {
  id: string
  scene: string
  name: string
  /** 简易组标签颜色：gray/red/blue/.../rose。空字符串表示无色（与后端 ALLOWED_COLORS 对齐） */
  color: string
  sort_order: number
  /** 该组下提示词条数（后端 JOIN 一次性给出，前端不再二次查询） */
  prompt_count: number
  created_at: string
  updated_at: string
}

export interface UserToolPrompt {
  id: string
  scene: string
  /** 可选；为空时列表展示为「未命名」 */
  title: string
  content: string
  /** 归属的分组 id；null = 未分组 */
  group_id: string | null
  created_at: string
  updated_at: string
}

// ============ 分组 ============
export async function fetchUserToolPromptGroups(scene: PromptScene): Promise<UserToolPromptGroup[]> {
  const res = await functionsRequest.get('/api/user-tool-prompt-groups', {
    params: { scene },
  })
  return (res.data?.data as UserToolPromptGroup[]) || []
}

export async function createUserToolPromptGroup(input: {
  scene: PromptScene
  name: string
  color?: string
  sort_order?: number
}): Promise<UserToolPromptGroup> {
  const res = await functionsRequest.post('/api/user-tool-prompt-groups', input)
  return res.data?.data as UserToolPromptGroup
}

export async function updateUserToolPromptGroup(
  id: string,
  input: { name?: string; color?: string; sort_order?: number },
): Promise<void> {
  await functionsRequest.put('/api/user-tool-prompt-groups', input, { params: { id } })
}

export async function deleteUserToolPromptGroup(id: string): Promise<void> {
  await functionsRequest.delete('/api/user-tool-prompt-groups', { params: { id } })
}

// ============ 提示词 ============
/**
 * 列表：
 *   groupId 省略 = 全部
 *   groupId === '__none__' = 未分组
 *   groupId = 字符串 = 该组（'null' 视同省略）
 */
export async function fetchUserToolPrompts(
  scene: PromptScene,
  groupId?: string | null,
): Promise<UserToolPrompt[]> {
  const params: Record<string, string> = { scene }
  if (groupId != null && groupId !== 'null') {
    params.groupId = groupId
  }
  const res = await functionsRequest.get('/api/user-tool-prompts', { params })
  return (res.data?.data as UserToolPrompt[]) || []
}

/** 新建；返回后端回填的完整记录（含 created_at/updated_at） */
export async function createUserToolPrompt(input: {
  scene: PromptScene
  title: string
  content: string
  group_id?: string | null
}): Promise<UserToolPrompt> {
  const res = await functionsRequest.post('/api/user-tool-prompts', input)
  return res.data?.data as UserToolPrompt
}

/** 更新；body 中 group_id 可选（undefined = 不改） */
export async function updateUserToolPrompt(
  id: string,
  input: { title?: string; content?: string; group_id?: string | null },
): Promise<void> {
  await functionsRequest.put('/api/user-tool-prompts', input, { params: { id } })
}

/** 删除 */
export async function deleteUserToolPrompt(id: string): Promise<void> {
  await functionsRequest.delete('/api/user-tool-prompts', { params: { id } })
}