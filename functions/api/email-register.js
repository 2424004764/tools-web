import { ApiResponse } from '../utils/db.js'
import { verifyCode, verifyCodeRejection } from './send-verification-code.js'
import { hashPassword } from '../utils/password.js'
import { getClientIp, hitLimit, fmtWaitSec } from '../utils/rate-limit.js'
import { grantRegistrationRewards } from '../services/registrationRewardService.js'
import { MAIN_JWT_TTL_SECONDS } from '../config/auth.js'

// 单 IP 每小时最多 10 次注册尝试（防批量注册；验证码爆破由 verifyCode 尝试上限拦截）
const IP_REGISTER_LIMIT = 10
const IP_REGISTER_WINDOW_SEC = 3600

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

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'), 405)
  }

  try {
    const { email: rawEmail, password, code, username } = await request.json()

    // 邮箱统一小写入：防止 User@x.com / user@x.com 变体绕过查重造成重复账号
    const email = String(rawEmail || '').trim().toLowerCase()

    if (!email || !password || !code || !username) {
      return ApiResponse.error('参数不完整', request.headers.get('Origin'), 400)
    }

    if (password.length < 6) {
      return ApiResponse.error('密码至少6位', request.headers.get('Origin'), 400)
    }

    // IP 级注册频控（在验证码校验前拦截）
    const ip = getClientIp(request)
    if (ip) {
      const r = await hitLimit(env.VERIFICATION_CODES, `rl:reg:${ip}`, IP_REGISTER_LIMIT, IP_REGISTER_WINDOW_SEC)
      if (!r.allowed) {
        return ApiResponse.error(`注册过于频繁，请 ${fmtWaitSec(r.retryAfterSec)}后再试`, request.headers.get('Origin'), 429, null, {
          'Retry-After': String(r.retryAfterSec)
        })
      }
    }

    // 验证验证码（错误尝试计数存 D1 原子自增，达上限作废并返回 429）
    const verifyResult = await verifyCode(env, email, 'register', code)
    if (!verifyResult.ok) {
      return verifyCodeRejection(verifyResult, request.headers.get('Origin'))
    }

    // 检查邮箱是否已注册（NOCASE 兼容历史大小写混用的存量数据）
    const existing = await env.DB.prepare('SELECT id FROM user WHERE email = ? COLLATE NOCASE').bind(email).first()
    if (existing) {
      return ApiResponse.error('该邮箱已注册', request.headers.get('Origin'), 409)
    }

    // PBKDF2 加盐哈希（hashPassword 内部生成随机盐）
    const { salt, hash: hashedPassword } = await hashPassword(password)

    // 创建用户
    const userId = crypto.randomUUID()
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await env.DB.prepare(
      'INSERT INTO user (id, email, username, password, salt, avatar, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, email, username, hashedPassword, salt, '', now, now).run()
    await grantRegistrationRewards(env.DB, userId)

    // 生成JWT（ver 与库中 token_version 对齐，新用户为 0）
    const token = await generateJWT({ uid: userId, email, username, avatar: '', is_admin: 0, ver: 0 }, env.JWT_SECRET)

    return ApiResponse.success({ token, username }, request.headers.get('Origin'))
  } catch (error) {
    console.error('Email register error:', error)
    return ApiResponse.error('注册失败', request.headers.get('Origin'), 500)
  }
}
