// 用户端工具使用记录 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type { RecentTool } from '@/utils/tool-usage'

export type { RecentTool }

/**
 * 上报一次工具使用。
 * 后端对匿名请求静默 noop；前端失败也仅 console.warn（见 utils/tool-usage.ts 兜底）。
 */
export async function postToolUsage(toolUrl: string, toolTitle: string): Promise<void> {
  await functionsRequest.post('/api/me/tool-usage', {
    tool_url: toolUrl,
    tool_title: toolTitle,
  })
}

/**
 * 拉取当前用户最近 8 个去重工具。
 * 未登录返回 { items: [] }。
 */
export async function fetchRecentToolUsage(): Promise<{ items: RecentTool[] }> {
  const res = await functionsRequest.get('/api/me/tool-usage/recent')
  return res.data.data
}