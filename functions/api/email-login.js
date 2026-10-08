import { ApiResponse } from '../utils/db.js'
import { verifyCode } from './send-verification-code.js'

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

// 从邮箱前缀生成用户名，重名时追加随机数字后缀
const generateUsername = async (env, email) => {
  const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '').slice(0, 20) || 'user'
  const exists = await env.DB.prepare('SELECT id FROM user WHERE username = ?').bind(prefix).first()
  return exists ? `${prefix}${Math.floor(1000 + Math.random() * 9000)}` : prefix
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'))
  }

  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return ApiResponse.error('参数不完整', request.headers.get('Origin'))
    }

    // 验证验证码
    if (!(await verifyCode(env, email, 'login', code))) {
      return ApiResponse.error('验证码错误或已过期', request.headers.get('Origin'))
    }

    // 查询用户
    let user = await env.DB.prepare('SELECT id, email, username, avatar, is_admin FROM user WHERE email = ?').bind(email).first()
    let isNewUser = false

    // 未注册则自动注册（邮箱所有权已通过验证码验证）
    if (!user) {
      const userId = crypto.randomUUID()
      const username = await generateUsername(env, email)
      const now = new Date().toISOString()
      await env.DB.prepare(
        'INSERT INTO user (id, email, username, password, salt, avatar, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(userId, email, username, '', '', '', now, now).run()
      user = { id: userId, email, username, avatar: '', is_admin: 0 }
      isNewUser = true
    }

    // 生成JWT
    const token = await generateJWT({ uid: user.id, email: user.email, username: user.username, avatar: user.avatar || '', is_admin: user.is_admin ? 1 : 0 }, env.JWT_SECRET)

    return ApiResponse.success({ token, username: user.username, isNewUser }, request.headers.get('Origin'))
  } catch (error) {
    console.error('Email login error:', error)
    return ApiResponse.error('登录失败', request.headers.get('Origin'), 500)
  }
}
