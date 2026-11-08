/**
 * Admin 静态资源访问票据（HMAC 短时效票据）
 *
 * 背景：admin 页面 chunk（/js/<releaseId>-AdminXxx-<hash>.js）由浏览器 dynamic
 * import 加载，请求无法携带 Authorization 头，只能用 HttpOnly cookie 做资产级
 * 鉴权。票据是 `uid.exp.signature` 三段式：
 *   - 仅由「已通过 JWT + is_admin 校验」的服务端代码签发（asset-ticket 端点 /
 *     admin _middleware 滑动续期）；
 *   - 验证只做 HMAC 验签 + 过期检查，不查 D1，开销可忽略；
 *   - TTL 1 小时：管理员被降权后最迟 1 小时失去 chunk 下载能力（比主 JWT 的
 *     7 天短得多），期间任何 admin API 请求都会滚动续期并即时复核 is_admin。
 *
 * 全局 _middleware.js 用 verifyAssetTicket 守门；cookie 属性见 assetTicketCookie。
 */

export const ASSET_TICKET_COOKIE = 'adm_assets'
export const ASSET_TICKET_TTL_SECONDS = 3600

function base64urlEncode(bytes) {
  let bin = ''
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/**
 * 为已鉴权的管理员签发访问票据
 * @param {string} uid 管理员 uid
 * @param {string} secret JWT_SECRET
 * @returns {Promise<string>} `uid.exp.signature`（base64url）
 */
export async function mintAssetTicket(uid, secret) {
  const exp = Math.floor(Date.now() / 1000) + ASSET_TICKET_TTL_SECONDS
  const body = `${uid}.${exp}`
  const key = await hmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return `${body}.${base64urlEncode(signature)}`
}

/**
 * 校验票据：验签 + 过期检查，合法返回 uid，非法返回 null。
 * crypto.subtle.verify 自带常数时间比较。
 */
export async function verifyAssetTicket(ticket, secret) {
  if (!ticket || !secret) return null
  // uid 是 UUID 不含点号；从右往左找两段，容忍 uid 意外含分隔符时不至于验签穿越
  const sigIndex = ticket.lastIndexOf('.')
  const expIndex = ticket.lastIndexOf('.', sigIndex - 1)
  if (sigIndex <= 0 || expIndex <= 0) return null
  const uid = ticket.slice(0, expIndex)
  const exp = Number(ticket.slice(expIndex + 1, sigIndex))
  const signature = ticket.slice(sigIndex + 1)
  if (!uid || !Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) return null
  try {
    const key = await hmacKey(secret)
    const valid = await crypto.subtle.verify('HMAC', key, base64urlDecode(signature), new TextEncoder().encode(`${uid}.${exp}`))
    return valid ? uid : null
  } catch {
    return null
  }
}

/**
 * 票据 Set-Cookie 值。Path 限定 /js：只有代码 chunk 请求会携带，
 * 不会随 /api/* 等业务请求外发。
 */
export function assetTicketCookie(ticket) {
  return `${ASSET_TICKET_COOKIE}=${ticket}; HttpOnly; Secure; SameSite=Lax; Path=/js; Max-Age=${ASSET_TICKET_TTL_SECONDS}`
}

/** 从 Cookie 请求头解析键值对 */
export function parseCookieHeader(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0) {
      const name = part.slice(0, i).trim()
      try {
        out[name] = decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        out[name] = part.slice(i + 1).trim()
      }
    }
  }
  return out
}
