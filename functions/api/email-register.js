import { ApiResponse } from '../utils/db.js'
import { verifyCode } from './send-verification-code.js'

// 密码加盐哈希
const hashPassword = async (password, salt) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 生成JWT
const generateJWT = async (payload, secret) => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const jwtPayload = { ...payload, iat: now, exp: now + 30 * 86400 }

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
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'))
  }

  try {
    const { email, password, code, username } = await request.json()

    if (!email || !password || !code || !username) {
      return ApiResponse.error('参数不完整', request.headers.get('Origin'))
    }

    if (password.length < 6) {
      return ApiResponse.error('密码至少6位', request.headers.get('Origin'))
    }

    // 验证验证码
    if (!verifyCode(email, 'register', code)) {
      return ApiResponse.error('验证码错误或已过期', request.headers.get('Origin'))
    }

    // 检查邮箱是否已注册
    const existing = await env.DB.prepare('SELECT id FROM user WHERE email = ?').bind(email).first()
    if (existing) {
      return ApiResponse.error('该邮箱已注册', request.headers.get('Origin'))
    }

    // 生成随机盐
    const salt = crypto.randomUUID()

    // 加密密码
    const hashedPassword = await hashPassword(password, salt)

    // 创建用户
    const userId = crypto.randomUUID()
    const now = new Date().toISOString()
    await env.DB.prepare(
      'INSERT INTO user (id, email, username, password, salt, avatar, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, email, username, hashedPassword, salt, '', now, now).run()

    // 生成JWT
    const token = await generateJWT({ uid: userId, email, username, avatar: '', is_admin: 0 }, env.JWT_SECRET)

    return ApiResponse.success({ token, username }, request.headers.get('Origin'))
  } catch (error) {
    console.error('Email register error:', error)
    return ApiResponse.error('注册失败', request.headers.get('Origin'), 500)
  }
}
