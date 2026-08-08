/**
 * 版本指纹守卫
 *
 * 解决的问题：
 *   用户初次加载 SPA 后停留在页面，CF 上重新部署（chunk hash 全变了），
 *   此时用户再点击任意路由 → 动态 import 旧 hash 的 chunk → 404 → 卡 loading。
 *
 * 做法：
 *   1. 启动时记录 document 上主入口 chunk 的 hash 作为当前 SPA 指纹
 *   2. 定期拉带 cache-bust 的根路径 HTML 提取服务器侧最新指纹
 *   3. 暴露 isAppStale() 给路由 beforeEach 调用，true 时硬刷到目标 URL
 *
 * 效果：
 *   用户在点击的"瞬间"被透明地刷新到新版本，永远落到正确的页面。
 *   用户体感是"点完直接到目标页"，感知不到中间发生了一次刷新。
 */

const POLL_INTERVAL = 30_000 // 30s 轮询一次

// 内存缓存：服务器侧最新指纹
let latestFingerprint = ''

// 是否已完成至少一次版本检查（用于区分"尚未检查"和"检查后发现一致"）
let hasChecked = false

// 探测 URL key：build:pro 会自动生成生产值；dev 不需要该机制。
const PROBE_PARAM = import.meta.env.VITE_VERSION_PROBE_PARAM || '__v'

/**
 * 从当前 document 提取主入口 chunk 的 hash 作为指纹。
 * 任何一边提取不到（DOM 中没有入口 script）时返回空字符串，
 * 调用方应直接放弃本轮 stale 判断，宁可不刷也不要误判。
 */
function extractCurrentFingerprint(): string {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="/js/index-"]')
  for (const s of Array.from(scripts)) {
    const m = s.src.match(/\/js\/index-([a-f0-9]+)\.js/)
    if (m) return m[1]
  }
  return ''
}

/**
 * 拉取服务器侧最新部署的 HTML 并提取入口 hash。
 * 使用带 cache-bust 的查询参数走根路径，避免命中旧 SW 的预缓存和边缘缓存。
 */
async function fetchLatestFingerprint(): Promise<string> {
  const probeUrl = `/?${PROBE_PARAM}=${Date.now()}`
  const res = await fetch(probeUrl, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  })
  if (!res.ok) throw new Error(`status ${res.status}`)
  const html = await res.text()
  const m = html.match(/\/js\/index-([a-f0-9]+)\.js/)
  return m ? m[1] : ''
}

/**
 * 当前 SPA 落后于服务器部署版本？
 * - 首次启动（还没轮询过）→ false
 * - 任一侧指纹缺失 → false（防误判）
 * - 服务器指纹与当前 SPA 指纹不一致 → true
 */
export function isAppStale(): boolean {
  if (!latestFingerprint) return false
  const current = extractCurrentFingerprint()
  if (!current) return false
  return latestFingerprint !== current
}

/**
 * 是否已完成至少一次版本检查。
 * 用于 router beforeEach：在首次检查完成前不清除硬刷计数器，
 * 避免「页面刚加载、latestFingerprint 尚为空 → isAppStale()=false → 计数器被错误重置」。
 */
export function isVersionCheckComplete(): boolean {
  return hasChecked
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
    const next = await fetchLatestFingerprint()
    if (next) {
      latestFingerprint = next
    }
    hasChecked = true
  } catch {
    // 静默：网络/部署瞬时错误不影响主流程
  }
}