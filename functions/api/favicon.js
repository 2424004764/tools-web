// 站点图标代理
// GET /api/favicon?domain=<hostname>&sz=<32|64|128>
//
// 为什么需要：书签等工具的图标此前由浏览器直连
// https://www.google.com/s2/favicons —— 国内网络无法访问 Google，
// 图标全部裂开并刷一排控制台 404。改为本代理后浏览器只请求同源地址，
// 由 Cloudflare 出口取上游（可直连 Google），对任何访客都稳定。
//
// 与 /api/image-proxy 的区别：
//   - 不代理任意 URL，只把「校验过的 hostname」拼进两个固定上游，
//     无 SSRF 面，不需要私网 IP 检查与逐跳重定向校验
//   - 上游失败不报 4xx/5xx，而是 302 到本地兜底图标 —— 既让 <img>
//     无感降级，也避免被 _middleware 的 api_error_logs 记成噪音日志
//
// 缓存策略：
//   - caches.default 边缘缓存（同 URL 在边缘节点只回源一次）
//   - 浏览器 Cache-Control 7 天（favicon 极少变化）
//   - 兜底 302 不进边缘缓存，避免瞬时故障被长期固化

const ALLOWED_SIZES = new Set([32, 64, 128])
const FALLBACK_ICON = '/images/logo/link.png'

// hostname 白名单校验：常规域名（至少一个点）或 IPv4 字面量。
// 拦下 t<box.co 这类脏数据与注入尝试——上游 URL 是拼出来的，输入必须收紧。
function isValidDomain(host) {
  if (!host || host.length > 253) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true
  return (
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host) &&
    host.split('.').every((label) => label.length <= 63)
  )
}

function fallbackRedirect(request, maxAge = 300) {
  const target = new URL(FALLBACK_ICON, request.url).toString()
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      // 兜底也短缓存一下，脏数据域名不至于每次都打进来
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  })
}

export async function onRequest(context) {
  // 注意：Pages Functions 的 context 没有 ctx 字段（那是 Workers 模块写法），
  // waitUntil 直接挂在 context 上
  const { request, waitUntil } = context
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ ok: false, error: '不支持的请求方法' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)

  // 容错：调用方传完整 URL 也接受，取其 hostname
  let domain = (url.searchParams.get('domain') || '').trim().toLowerCase()
  if (/:\/\//.test(domain)) {
    try {
      domain = new URL(domain).hostname
    } catch {
      domain = ''
    }
  }
  if (!isValidDomain(domain)) return fallbackRedirect(request)

  const szParam = Number(url.searchParams.get('sz'))
  const sz = ALLOWED_SIZES.has(szParam) ? szParam : 64

  // 边缘缓存 key 用规范化 URL，忽略调用方多传的杂项参数
  const cacheKey = new Request(`https://${url.hostname}/api/favicon?domain=${domain}&sz=${sz}`)

  const cache = caches.default
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  // 上游优先 Google（图标质量好、未知域名也返回默认地球），
  // 网络异常时退 DuckDuckGo；两者都在固定域名下拼参数，无任意跳转
  const upstreams = [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=${sz}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ]

  for (const upstream of upstreams) {
    try {
      const res = await fetch(upstream, {
        method: 'GET',
        headers: { Accept: 'image/*' },
        cf: { cacheTtl: 86400, cacheEverything: true },
      })
      if (!res.ok) {
        console.error('[favicon] upstream !ok', upstream, res.status)
        continue
      }
      const contentType = res.headers.get('Content-Type') || ''
      if (!contentType.startsWith('image/')) {
        console.error('[favicon] upstream non-image', upstream, contentType)
        continue
      }

      const response = new Response(res.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=604800',
        },
      })
      // HEAD 响应无 body，写入缓存会污染后续 GET（命中后返回空图片），不缓存
      if (request.method === 'GET') {
        waitUntil(cache.put(cacheKey, response.clone()))
      }
      return response
    } catch (err) {
      console.error('[favicon] upstream fetch threw', upstream, err?.message || err)
    }
  }

  return fallbackRedirect(request)
}
