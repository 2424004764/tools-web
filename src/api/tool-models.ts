// 公开的工具 model 列表 API 封装
import { functionsRequest } from '@/utils/functionsRequest'

export interface PublicToolModel {
  model_key: string
  model_label: string
  description: string | null
  credit_cost: number
  is_default: boolean
}

export async function fetchToolModels(toolUrl: string): Promise<PublicToolModel[]> {
  const res = await functionsRequest.get('/api/tools/models', { params: { url: toolUrl } })
  // 后端返回 { ok, url, models }，顶层就是 models
  return (res.data?.models as PublicToolModel[]) || []
}
