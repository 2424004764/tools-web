// 用户级提示词库 API 封装
// 后端：functions/api/user-tool-prompts.js
//
// 场景（scene）取值：'ai-image-edit' / 'ai-outfit'。新增工具时同步后端 ALLOWED_SCENES。
// 所有请求都强制要求登录（后端 uid 校验），前端 axios 拦截器会自动带 Bearer token。

import { functionsRequest } from '@/utils/functionsRequest'

/** 支持的场景标识。新增工具时同时改这里和后端 ALLOWED_SCENES。 */
export type PromptScene = 'ai-image-edit' | 'ai-outfit'

export interface UserToolPrompt {
  id: string
  scene: string
  /** 可选；为空时列表展示为「未命名」 */
  title: string
  content: string
  created_at: string
  updated_at: string
}

/** 列表 */
export async function fetchUserToolPrompts(scene: PromptScene): Promise<UserToolPrompt[]> {
  const res = await functionsRequest.get('/api/user-tool-prompts', {
    params: { scene },
  })
  return (res.data?.data as UserToolPrompt[]) || []
}

/** 新建；返回后端回填的完整记录（含 created_at/updated_at） */
export async function createUserToolPrompt(input: {
  scene: PromptScene
  title: string
  content: string
}): Promise<UserToolPrompt> {
  const res = await functionsRequest.post('/api/user-tool-prompts', input)
  return res.data?.data as UserToolPrompt
}

/** 更新；后端返回 { success: true }，此处不需要回填 */
export async function updateUserToolPrompt(id: string, input: { title: string; content: string }): Promise<void> {
  await functionsRequest.put('/api/user-tool-prompts', input, { params: { id } })
}

/** 删除 */
export async function deleteUserToolPrompt(id: string): Promise<void> {
  await functionsRequest.delete('/api/user-tool-prompts', { params: { id } })
}