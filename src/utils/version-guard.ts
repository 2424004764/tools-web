/**
 * 版本指纹守卫（被动检查）
 *
 * 解决的问题：
 *   用户初次加载 SPA 后停留在页面，CF 上重新部署（chunk hash 全变了），
 *   此时用户再点击任意路由 → 动态 import 旧 hash 的 chunk → 404 → 卡 loading。
 *
 * 做法（已改造为"被动检查"，原 30s setInterval 轮询版已移除以节省 CF Pages 请求次数）：
 *   1. 启动时记录 document 上主入口 chunk 的 hash 作为当前 SPA 指纹
 *   2. 路由跳转时（router.beforeEach）异步检查一次：拉带 cache-bust 的根 HTML
 *      提取服务器侧最新指纹，发现不一致 → 硬刷到目标 URL
 *   3. bfcache 恢复（pageshow.persisted=true）也走同一套检查
 *
 * 效果：
 *   用户在点击的"瞬间"被透明地刷新到新版本，永远落到正确的页面。
 *   没有定时器，零后台轮询请求。
 */

const PROBE_PARAM = import.meta.env.VITE_VERSION_PROBE_PARAM || '__inline_v'

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

// 服务端指纹检查 Promise：单飞模式（同一时间只允许一个 in-flight 请求）
let inflightProbe: Promise<string> | null = null
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
      // 让后续请求 5s 后才能复用（避免硬刷瞬间又被同一来源触发）
      setTimeout(() => {
        inflightProbe = null
      }, 5_000)
    }
  })()
  return inflightProbe
}

// 单次"检查后是否需要硬刷"的入口；路由跳转时调用。
// 当前 SPA 落后于服务器部署版本 → 返回 true，调用方应 next(false) 然后 replace 到目标 URL。
export async function checkAppStale(targetUrl: string): Promise<string | null> {
  const current = readCurrentFingerprint()
  if (!current) return null
  const server = await probeServerFingerprint()
  if (!server) return null
  if (server === current) return null
  // 保留 query + hash；硬刷到目标 URL（保持路径一致）
  return targetUrl
}

// 兼容旧名（已不再被引用，保留以防外部依赖）
export function isAppStale(): boolean {
  return false
}