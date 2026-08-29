// 用户工具收藏 API
// 工具是前端静态清单（tools.ts），后端只存 tool_url；标题/logo 由前端投影 toolsStore.cates
import { functionsRequest } from '@/utils/functionsRequest'

/** 规范化收藏标识：去尾部斜杠（tools.ts 约 94% 的 url 带尾斜杠，
 *  详情页路由路径不带——两侧必须归一到同一 key，否则收藏状态对不上） */
export const normalizeToolUrl = (url: string): string =>
  url.length > 1 ? url.replace(/\/+$/, '') : url

/**
 * 获取当前用户收藏的工具 url 列表（按收藏时间倒序，已规范化并去重）。
 * 注意：调用方必须先判断登录态（未登录请求会命中 401 拦截器强制登出跳转）。
 * 请求失败静默返回空数组——收藏是非关键数据，不应阻塞首页。
 */
export async function fetchFavoriteToolUrls(): Promise<string[]> {
  try {
    const res = await functionsRequest.get('/api/favorite-tools')
    const data = res?.data?.data
    if (!Array.isArray(data)) return []
    const seen = new Set<string>()
    const result: string[] = []
    for (const raw of data) {
      if (typeof raw !== 'string') continue
      const url = normalizeToolUrl(raw)
      if (seen.has(url)) continue
      seen.add(url)
      result.push(url)
    }
    return result
  } catch (err) {
    console.warn('[favorite-tools] 收藏列表加载失败：', err)
    return []
  }
}

/** 收藏工具。tool_url 对齐 tools.ts 的 url 字段（内部统一规范化后提交） */
export async function addFavoriteTool(toolUrl: string): Promise<void> {
  await functionsRequest.post('/api/favorite-tools', {
    tool_url: normalizeToolUrl(toolUrl),
  })
}

/** 取消收藏（后端幂等：不存在也返回成功） */
export async function removeFavoriteTool(toolUrl: string): Promise<void> {
  await functionsRequest.delete('/api/favorite-tools', {
    params: { tool_url: normalizeToolUrl(toolUrl) },
  })
}
