// 工具使用记录：前端埋点 + 拉取最近使用
//
// 关键设计：
//   1. 路由切换打点（router afterEach 调用 recordToolUsage）
//   2. 30 秒 sessionStorage 去重，避免刷新/回退产生噪音
//   3. 仅命中 tools.ts 中注册的 URL 才打点（保守策略：新增工具零成本生效）
//   4. 仅登录用户打点（由 router 侧判断；本 util 不再重复判断）

import { getToolsCate } from '@/components/Tools/tools'
import { detectSource } from './source'

const STORAGE_PREFIX = 'tu_'
const DEDUPE_MS = 30_000

export interface RecentTool {
  tool_url: string
  tool_title: string
  /** 秒级时间戳 */
  last_used_at: number
  /** 该工具累计使用次数 */
  use_count: number
}

/**
 * 把 tools.ts 静态数据铺平成 url → title 的 Map，方便 O(1) 查表。
 * 注意：与 useToolsStore 的运行时数据可能略有差异（DB 可能新增/下架了工具），
 * 但 store 数据走的是 /api/tools 异步加载，路由 afterEach 时机不可靠；
 * tools.ts 是 build-time 静态注入，命中即代表"已上线工具"，足够用。
 */
let _toolUrlMap: Map<string, string> | null = null
function getToolUrlMap(): Map<string, string> {
  if (_toolUrlMap) return _toolUrlMap
  const map = new Map<string, string>()
  for (const cate of getToolsCate()) {
    for (const tool of cate.list || []) {
      if (tool.url) map.set(tool.url, tool.title)
    }
  }
  _toolUrlMap = map
  return map
}

/**
 * 把任意路径标准化为 tools.ts 中的 url 形式：
 *   - 去掉首尾 /
 *   - 拼接回 '/xxx/'
 * 用于兼容路由参数（如 /img-puzzle/foo 应归一到 /img-puzzle/）
 */
function normalizeUrl(path: string): string {
  const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!trimmed) return ''
  return `/${trimmed}/`
}

/**
 * 根据当前路径查找对应工具（含 title）。
 * 返回 null 表示该路径不是工具页面。
 */
export function matchToolByPath(path: string): { url: string; title: string } | null {
  const url = normalizeUrl(path)
  if (!url) return null
  const map = getToolUrlMap()
  const title = map.get(url)
  if (!title) return null
  return { url, title }
}

/**
 * 上报一次工具使用。
 * - 30 秒内同工具不重复打点（sessionStorage 去重）
 * - 失败仅 console.warn，绝不抛错
 * - fire-and-forget：不 await
 * - source 在调用时同步解析（detectSource 内部已锁定到 sessionStorage），
 *   同一会话内所有工具共享同一来源，避免站内跳转被误判
 */
export function recordToolUsage(toolUrl: string, toolTitle: string): void {
  try {
    const key = STORAGE_PREFIX + toolUrl
    const last = Number(sessionStorage.getItem(key) || '0')
    const now = Date.now()
    if (last && now - last < DEDUPE_MS) return
    sessionStorage.setItem(key, String(now))

    // 推广来源解析（utm_source 优先 → referer 指纹 → direct）
    const source = detectSource()

    // 动态 import 避免循环依赖；fire-and-forget
    void import('@/api/me/tool-usage')
      .then(({ postToolUsage }) => postToolUsage(toolUrl, toolTitle, source))
      .catch((err) => {
        console.warn('[tool-usage] record failed:', err?.message || err)
      })
  } catch (err) {
    // sessionStorage 在隐私模式下可能抛错；不要影响路由
    console.warn('[tool-usage] dedupe check failed:', (err as Error)?.message || err)
  }
}

/**
 * 拉取当前登录用户的最近使用工具（最多 8 个）。
 * 未登录时返回空数组（API 也会返回空数组，但本地短路省一次请求）。
 */
export async function fetchRecentUsedTools(): Promise<RecentTool[]> {
  try {
    const { fetchRecentToolUsage } = await import('@/api/me/tool-usage')
    const res = await fetchRecentToolUsage()
    return res?.items || []
  } catch (err) {
    console.warn('[tool-usage] fetchRecentUsedTools failed:', (err as Error)?.message || err)
    return []
  }
}