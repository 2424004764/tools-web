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
//   - 拒绝指向内网/本机 IP 的 URL（127.0.0.0/8、10/8、172.16/12、192.168/16、169.254/16、::1、fc00::/7）
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

  // IPv6：本地回环 + 唯一本地地址
  if (hostname === '::1' || hostname === '[::1]') return true
  if (/^fc[0-9a-f]{2}:/i.test(hostname) || /^fd[0-9a-f]{2}:/i.test(hostname)) return true

  // IPv4 文本（含 IPv4-mapped IPv6 的尾部）
  const m = hostname.match(/(?:^|\.)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const [, a, b, c, d] = m
    const oct = [a, b, c, d].map(Number)
    if (oct.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
    if (oct[0] === 10) return true                          // 10.0.0.0/8
    if (oct[0] === 127) return true                         // 127.0.0.0/8 回环
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

export async function onRequest(context) {
  const { request } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

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
    const upstream = await fetch(parsed.toString(), {
      // 跟随 5 次重定向够用，避免无限循环
      redirect: 'follow',
    })
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
