// 通用图片代理
// GET /api/image-proxy?url=<encoded>
//
// 为什么需要：第三方图床（如 bafang.me / img.pinest.xyz）通常不带 CORS 头，
// 浏览器 fetch 会跨域失败。后端 fetch 没有 CORS 限制，代理转发即可。
// 与 /api/me/generation-records/:id/image 的区别：
//   - 不要求登录（ImgCut 是公开工具，跳转带任意 URL 都能用）
//   - 不依赖 generation_records 表（任何外链图片都能代理）
//
// 安全措施（防 SSRF）：
//   - 只允许 http/https 协议
//   - 拒绝指向内网/本机 IP 的 URL（127.0.0.0/8、10/8、172.16/12、192.168/16、169.254/16、::1、fc00::/7、fe80::/10，
//     以及 2130706433 这类十进制/八进制/十六进制等非标准 IP 文本形式）
//   - 重定向逐跳校验（redirect:'manual' + Location 复查），防止公网 URL 302 跳内网
//   - 上游返回非 image/* Content-Type 时直接 502 拒绝转发（避免被滥用当通用 HTTP 代理）

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// 同步解析 hostname（DNS 解析可能慢，这里只校验字面 IP，省一次 DNS 也能挡住大部分 SSRF）
function isPrivateHost(hostname) {
  if (!hostname) return true

  // IPv6：本地回环 + 唯一本地地址 + 链路本地（对应 IPv4 的 169.254/16）
  if (hostname === '::1' || hostname === '[::1]') return true
  if (/^fc[0-9a-f]{2}:/i.test(hostname) || /^fd[0-9a-f]{2}:/i.test(hostname)) return true
  if (/^fe[89ab][0-9a-f]:/i.test(hostname)) return true

  // IPv4 字面量：覆盖三类写法 —— 标准点分四段、十进制整数（http://2130706433/ = 127.0.0.1）、
  // 以及八进制段/十六进制段/缺段等非标准形式（一律拒绝：正常图床不会用这些形式当主机名）
  let host = hostname
  if (host.includes(':')) {
    // IPv6 里嵌的 IPv4 尾巴（如 ::ffff:10.0.0.1）；纯 IPv6 已由上方前缀判定覆盖
    const tail = host.split(':').pop()
    if (tail && tail.includes('.')) host = tail
    else return host === '::' // ::（未指定地址）视为私网
  }
  // 十六进制 IP 形式（0x7f000001 / 0x7f.0.0.1 = 127.0.0.1）：直接拒绝
  if (/^0x[0-9a-f.]+$/i.test(host)) return true
  if (/^[\d.]+$/.test(host)) {
    let oct = null
    if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(host)) {
      oct = host.split('.').map(Number)
      if (oct.some((n) => n > 255)) return true
    } else if (/^\d{1,10}$/.test(host)) {
      const n = Number(host)
      if (n > 0xffffffff) return true
      oct = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
    } else {
      return true // 0177.0.0.1（八进制）、0x7f.0.0.1（十六进制段）、1.2.3（缺段）等
    }
    if (oct[0] === 10) return true                          // 10.0.0.0/8
    if (oct[0] === 127) return true                         // 127.0.0.0/8
    if (oct[0] === 0) return true                           // 0.0.0.0/8
    if (oct[0] === 169 && oct[1] === 254) return true       // 169.254.0.0/16 link-local
    if (oct[0] === 172 && oct[1] >= 16 && oct[1] <= 31) return true // 172.16/12
    if (oct[0] === 192 && oct[1] === 168) return true       // 192.168/16
    // 100.64.0.0/10 (CGNAT) 和 198.18.0.0/15 (benchmark) 也算内网
    if (oct[0] === 100 && oct[1] >= 64 && oct[1] <= 127) return true
    if (oct[0] === 198 && (oct[1] === 18 || oct[1] === 19)) return true
  }

  // 字面 localhost
  if (hostname.toLowerCase() === 'localhost') return true

  return false
}

// 防盗链：仅放行站点自身页面发起的请求，防止被第三方热链当免费图床/带宽放大器。
// 站内三处调用（AiImageEdit / ImgCut / MyAiCreations）均为同源 fetch()，
// 会带 Sec-Fetch-Site: same-origin；旧浏览器退回 Referer 同源校验。
// 注意：这挡的是 <img> 热链与裸脚本，伪造 Referer/Sec-Fetch-Site 的自定义客户端仍可绕过——
// 彻底封死需上游域名白名单，但 ImgCut 设计上要支持任意 URL，故不做硬白名单。
function isSiteOriginRequest(request) {
  const secFetchSite = request.headers.get('Sec-Fetch-Site')
  if (secFetchSite) {
    return secFetchSite === 'same-origin' || secFetchSite === 'same-site'
  }
  const referer = request.headers.get('Referer')
  if (!referer) return false
  try {
    return new URL(referer).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

// 逐跳跟随重定向：每一跳的 Location 都重新过协议白名单 + isPrivateHost。
// redirect:'follow' 的自动跟随不做任何复查，公网 URL 302 跳向
// 127.0.0.1 / 169.254.169.254（云元数据）即可绕过首跳私网校验。
async function fetchWithRedirectGuard(startUrl, maxHops = 5) {
  let current = startUrl
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await fetch(current, { redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('Location')
      if (!loc) return res // 无 Location 的 3xx 按最终响应处理
      let next
      try {
        next = new URL(loc, current)
      } catch {
        return res
      }
      if (next.protocol !== 'http:' && next.protocol !== 'https:') return res
      if (isPrivateHost(next.hostname)) {
        throw new Error('重定向目标主机不可访问')
      }
      // 中间 3xx 的 body 没有用途，取消以释放连接
      try {
        res.body?.cancel?.()
      } catch { /* noop */ }
      current = next.toString()
      continue
    }
    return res
  }
  throw new Error('重定向次数过多')
}

export async function onRequest(context) {
  const { request } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  if (!isSiteOriginRequest(request)) {
    return jsonError('仅允许站内使用图片代理', 403)
  }

  const url = new URL(request.url)
  const target = url.searchParams.get('url')
  if (!target) return jsonError('缺少 url 参数', 400)

  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return jsonError('url 格式不合法', 400)
  }

  // 协议白名单
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return jsonError('仅支持 http/https 协议', 400)
  }

  // 主机白名单：拒绝内网/本机，避免被滥用扫描内网
  if (isPrivateHost(parsed.hostname)) {
    return jsonError('目标主机不可访问', 403)
  }

  // 服务端 fetch（无 CORS 限制），浏览器视角看到的是同源响应，自然没有跨域问题
  try {
    // 逐跳跟随重定向：每一跳重新过协议/私网校验（见 fetchWithRedirectGuard）
    const upstream = await fetchWithRedirectGuard(parsed.toString())
    if (!upstream.ok) {
      return jsonError(`上游返回 ${upstream.status}`, 502)
    }

    // 内容类型校验：只允许图片，避免被当通用 HTTP 代理滥用
    const contentType = upstream.headers.get('Content-Type') || ''
    if (!contentType.startsWith('image/')) {
      return jsonError(`不被允许的内容类型：${contentType}`, 415)
    }

    // Content-Length 兜底：图片一般不会很大，超过 50MB 直接拒绝
    const lenHeader = upstream.headers.get('Content-Length')
    if (lenHeader) {
      const len = Number(lenHeader)
      if (Number.isFinite(len) && len > 50 * 1024 * 1024) {
        return jsonError('图片过大（>50MB）', 413)
      }
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // 公共缓存：相同 URL 可复用上游结果，1 天内不重复拉
        'Cache-Control': 'public, max-age=86400',
        ...corsHeaders,
      },
    })
  } catch (err) {
    console.error('[image-proxy] upstream fetch failed', err)
    return jsonError('拉取图片失败：' + (err?.message || '网络异常'), 502)
  }
}
