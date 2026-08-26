// 用户端工具使用记录 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type { RecentTool } from '@/utils/tool-usage'

export type { RecentTool }

/**
 * 上报一次工具使用。
 * 后端对匿名请求静默 noop；前端失败也仅 console.warn（见 utils/tool-usage.ts 兜底）。
 * @param source 推广来源（utm_source 优先 → referer 指纹 → 'direct'）
 */
export async function postToolUsage(toolUrl: string, toolTitle: string, source: string): Promise<void> {
  await functionsRequest.post('/api/me/tool-usage', {
    tool_url: toolUrl,
    tool_title: toolTitle,
    source,
  })
}

/**
 * 拉取当前用户最近 N 个去重工具（默认 8，后端 clamp 到 [1, 50]）。
 * 未登录返回 { items: [] }。
 */
export async function fetchRecentToolUsage(limit = 8): Promise<{ items: RecentTool[] }> {
  const res = await functionsRequest.get(`/api/me/tool-usage/recent?limit=${limit}`)
  return res.data.data
}