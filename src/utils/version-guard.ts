/**
 * 版本指纹守卫
 *
 * 解决的问题：
 *   用户初次加载 SPA 后停留在页面，CF 上重新部署（chunk hash 全变了），
 *   此时用户再点击任意路由 → 动态 import 旧 hash 的 chunk → 404 → 卡 loading。
 *
 * 做法：
 *   1. 启动时记录 document 上主入口 chunk 的 hash 作为当前 SPA 指纹
 *   2. 定期拉 /index.html（带 cache: no-store）提取服务器侧最新指纹
 *   3. 暴露 isAppStale() 给路由 beforeEach 调用，true 时硬刷到目标 URL
 *
 * 效果：
 *   用户在点击的"瞬间"被透明地刷新到新版本，永远落到正确的页面。
 *   用户体感是"点完直接到目标页"，感知不到中间发生了一次刷新。
 */

const POLL_INTERVAL = 30_000 // 30s 轮询一次

// 内存缓存：服务器侧最新指纹
let latestFingerprint = ''

/**
 * 从当前 document 提取主入口 chunk 的 hash 作为指纹
 * 兜底：HTML 字符串长度（chunk 提取失败时仍能区分大小改动）
 */
function extractCurrentFingerprint(): string {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="/js/index-"]')
  for (const s of Array.from(scripts)) {
    const m = s.src.match(/\/js\/index-([a-f0-9]+)\.js/)
    if (m) return m[1]
  }
  return document.documentElement.outerHTML.length.toString()
}

/**
 * 拉取服务器侧最新部署的 index.html 并提取指纹
 */
async function fetchLatestFingerprint(): Promise<string> {
  const res = await fetch('/index.html?_=' + Date.now(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`status ${res.status}`)
  const html = await res.text()
  const m = html.match(/\/js\/index-([a-f0-9]+)\.js/)
  return m ? m[1] : html.length.toString()
}

/**
 * 当前 SPA 落后于服务器部署版本？
 * - 首次启动（还没轮询过）→ false
 * - 服务器指纹与内存中的 SPA 指纹不一致 → true
 */
export function isAppStale(): boolean {
  if (!latestFingerprint) return false
  return latestFingerprint !== extractCurrentFingerprint()
}

/**
 * 启动轮询。dev 模式跳过（HMR 不需要这套机制，且 /index.html 在 dev 下不存在）。
 */
export function startVersionGuard(): void {
  if (import.meta.env.DEV) return

  // 立即拉一次（不等 30s），让 stale 检测尽快生效
  pollLatest()

  setInterval(pollLatest, POLL_INTERVAL)
}

async function pollLatest(): Promise<void> {
  try {
    latestFingerprint = await fetchLatestFingerprint()
  } catch {
    // 静默：网络/部署瞬时错误不影响主流程
  }
}