/**
 * 版本指纹守卫（后台非阻塞检查）
 *
 * 解决的问题：
 *   用户初次加载 SPA 后停留在页面，CF 上重新部署（chunk hash 全变了），
 *   此时用户再点击任意路由 → 动态 import 旧 hash 的 chunk → 404 → 卡 loading。
 *
 * 做法（非阻塞版）：
 *   1. 启动时记录 document 上主入口 chunk 的 hash 作为当前 SPA 指纹
 *   2. 路由跳转时（router.beforeEach）后台异步探测一次：拉带 cache-bust 的根 HTML
 *      提取服务器侧最新指纹，发现不一致 → 硬刷到最新目标 URL。
 *      导航本身不等待探测结果，点击零延迟；
 *      「chunk 在探测返回前就 404」的竞态由 router.onError 硬刷兜底。
 *   3. 启动时 / bfcache 恢复（pageshow.persisted=true）的检查
 *      由 index.html 内联脚本负责，不经过本模块。
 *
 * 请求频率控制（部署是低频事件，无需每次跳转都探测）：
 *   - 单飞：同一时间最多一个 in-flight 探测
 *   - TTL：成功探测后 PROBE_TTL 内的路由跳转直接跳过探测；
 *     TTL 起点取页面加载时刻（index.html 启动探测已覆盖加载瞬间）
 *   - 失败退避：探测拿不到指纹时仅退避 FAILED_PROBE_BACKOFF，
 *     下一次跳转即重试，避免离线时长时间不检查
 */

const PROBE_PARAM = import.meta.env.VITE_VERSION_PROBE_PARAM || '__inline_v'
// 一次成功探测的结果有效期：期间的路由跳转不再发探测请求
const PROBE_TTL = 5 * 60_000
// 探测失败（网络错误 / 响应异常）后的短暂退避，避免离线时每次跳转都打请求
const FAILED_PROBE_BACKOFF = 30_000

// 同一会话最多硬刷 N 次版本不一致，超出后停止硬刷避免死循环
// （典型场景：CDN 边缘缓存返回老 hash 导致探测永远 stale）
const MAX_RELOADS_PER_SESSION = 3
const RELOAD_COUNT_KEY = '__reload_count__'
// 两次硬刷之间最短间隔（ms），防止 硬刷→导航→探测 stale→硬刷 的快速循环
const MIN_RELOAD_INTERVAL = 5000
const LAST_RELOAD_TIME_KEY = '__last_reload_ts__'

// 当前 SPA 指纹（从 document 静态读取，只算一次）
let currentFingerprint = ''
function readCurrentFingerprint(): string {
  if (currentFingerprint) return currentFingerprint
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="/js/index-"]')
  for (const s of Array.from(scripts)) {
    const m = s.src.match(/\/js\/index-([a-f0-9]+)\.js/)
    if (m) {
      currentFingerprint = m[1]
      return currentFingerprint
    }
  }
  return ''
}

// 探测状态：in-flight promise 单飞 + 最近一次探测的时间与成败（TTL 判定用）
let inflightProbe: Promise<string> | null = null
let lastProbeAt = performance.timeOrigin || Date.now()
let lastProbeOk = true

async function probeServerFingerprint(): Promise<string> {
  if (inflightProbe) return inflightProbe
  inflightProbe = (async () => {
    try {
      const probeUrl = `/?${PROBE_PARAM}=${Date.now()}`
      const res = await fetch(probeUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      })
      if (!res.ok) return ''
      const html = await res.text()
      const m = html.match(/\/js\/index-([a-f0-9]+)\.js/)
      return m ? m[1] : ''
    } catch {
      return ''
    } finally {
      // 探测结束后延迟几秒才允许发起新探测（避免硬刷瞬间又被同一来源触发）
      setTimeout(() => {
        inflightProbe = null
      }, 5_000)
    }
  })()
  return inflightProbe
}

// 探测异步返回时用户可能已继续跳转，硬刷应去最新目标而非探测发起时的目标
let latestTargetUrl = '/'

/**
 * 版本守卫入口；路由跳转时调用，完全非阻塞。
 * 服务端已部署新版本 → 在会话次数 + 最小间隔双重保护下硬刷到最新目标 URL；
 * 未命中 → 什么都不发生，导航照常进行。
 */
export function guardStaleVersion(targetUrl: string): void {
  latestTargetUrl = targetUrl
  const current = readCurrentFingerprint()
  // 入口 chunk hash 读不到（构建产物结构变化）时放弃检查
  if (!current) return
  // TTL / 失败退避窗口内不再探测
  const elapsed = Date.now() - lastProbeAt
  if (elapsed < (lastProbeOk ? PROBE_TTL : FAILED_PROBE_BACKOFF)) return
  if (inflightProbe) return

  probeServerFingerprint().then((server) => {
    lastProbeAt = Date.now()
    lastProbeOk = !!server
    if (!server) return
    if (server === current) {
      // 版本一致：清掉之前的累计计数
      sessionStorage.removeItem(RELOAD_COUNT_KEY)
      sessionStorage.removeItem(LAST_RELOAD_TIME_KEY)
      return
    }
    const reloadCount = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0', 10)
    const lastReload = parseInt(sessionStorage.getItem(LAST_RELOAD_TIME_KEY) || '0', 10)
    const now = Date.now()
    if (reloadCount < MAX_RELOADS_PER_SESSION && (now - lastReload) > MIN_RELOAD_INTERVAL) {
      sessionStorage.setItem(RELOAD_COUNT_KEY, String(reloadCount + 1))
      sessionStorage.setItem(LAST_RELOAD_TIME_KEY, String(now))
      window.location.replace(latestTargetUrl)
    } else if (reloadCount >= MAX_RELOADS_PER_SESSION) {
      console.warn('[version-guard] 已达硬刷上限，跳过本轮。')
    }
  })
}

// 兼容旧名（已不再被引用，保留以防外部依赖）
export function isAppStale(): boolean {
  return false
}
