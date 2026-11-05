import { ApiResponse } from '../utils/db.js'
import { verifyCode } from './send-verification-code.js'
import { getClientIp, hitLimit, fmtWaitSec } from '../utils/rate-limit.js'
import { MAIN_JWT_TTL_SECONDS } from '../config/auth.js'

// 单 IP 每 10 分钟最多 30 次验证码登录尝试（验证码本身的爆破由 verifyCode 的
// 尝试次数上限拦截，这里再兜一层，防跨账号低频喷洒）
const IP_LOGIN_LIMIT = 30
const IP_LOGIN_WINDOW_SEC = 600

// 生成JWT
const generateJWT = async (payload, secret) => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const jwtPayload = { ...payload, iat: now, exp: now + MAIN_JWT_TTL_SECONDS }

  const base64url = (obj) => {
    const str = JSON.stringify(obj)
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  const headerB64 = base64url(header)
  const payloadB64 = base64url(jwtPayload)
  const data = `${headerB64}.${payloadB64}`

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  return `${data}.${signatureB64}`
}

// 从邮箱前缀生成用户名，重名时追加随机数字后缀
const generateUsername = async (env, email) => {
  const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '').slice(0, 20) || 'user'
  const exists = await env.DB.prepare('SELECT id FROM user WHERE username = ?').bind(prefix).first()
  return exists ? `${prefix}${Math.floor(1000 + Math.random() * 9000)}` : prefix
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'), 405)
  }

  try {
    const { email: rawEmail, code } = await request.json()

    // 邮箱统一小写：与验证码键、注册查重使用同一归一化值
    const email = String(rawEmail || '').trim().toLowerCase()

    if (!email || !code) {
      return ApiResponse.error('参数不完整', request.headers.get('Origin'), 400)
    }

    // IP 级尝试限流（在验证码校验前拦截）
    const ip = getClientIp(request)
    if (ip) {
      const r = await hitLimit(env.VERIFICATION_CODES, `rl:vlogin:${ip}`, IP_LOGIN_LIMIT, IP_LOGIN_WINDOW_SEC)
      if (!r.allowed) {
        return ApiResponse.error(`尝试过于频繁，请 ${fmtWaitSec(r.retryAfterSec)}后再试`, request.headers.get('Origin'), 429, null, {
          'Retry-After': String(r.retryAfterSec)
        })
      }
    }

    // 验证验证码
    if (!(await verifyCode(env, email, 'login', code))) {
      return ApiResponse.error('验证码错误或已过期', request.headers.get('Origin'), 401)
    }

    // 查询用户（NOCASE 兼容历史大小写混用的存量数据）
    let user = await env.DB.prepare(
      'SELECT id, email, username, avatar, is_admin, is_disabled, token_version FROM user WHERE email = ? COLLATE NOCASE'
    ).bind(email).first()
    let isNewUser = false

    if (user && user.is_disabled) {
      return ApiResponse.error('该账号已被禁用，如有疑问请联系站长', request.headers.get('Origin'), 403)
    }

    // 未注册则自动注册（邮箱所有权已通过验证码验证）
    if (!user) {
      const userId = crypto.randomUUID()
      const username = await generateUsername(env, email)
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
      await env.DB.prepare(
        'INSERT INTO user (id, email, username, password, salt, avatar, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(userId, email, username, '', '', '', now, now).run()
      user = { id: userId, email, username, avatar: '', is_admin: 0, token_version: 0 }
      isNewUser = true
    }

    // 生成JWT（ver 与库中 token_version 对齐，改密/重置后旧登录态失效）
    const token = await generateJWT({ uid: user.id, email: user.email, username: user.username, avatar: user.avatar || '', is_admin: user.is_admin ? 1 : 0, ver: user.token_version || 0 }, env.JWT_SECRET)

    return ApiResponse.success({ token, username: user.username, isNewUser }, request.headers.get('Origin'))
  } catch (error) {
    console.error('Email login error:', error)
    return ApiResponse.error('登录失败', request.headers.get('Origin'), 500)
  }
}
