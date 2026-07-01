import { ApiResponse } from '../utils/db.js'

async function hashPassword(password, salt) {
  const enc = new TextEncoder()
  const data = enc.encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function signJWT(payload, secret) {
  const enc = new TextEncoder()
  const header = { alg: 'HS256', typ: 'JWT' }
  const base64url = (buf) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

  const headerB64 = base64url(enc.encode(JSON.stringify(header)))
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)))
  const data = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const sigB64 = base64url(sig)

  return `${data}.${sigB64}`
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'))
  }

  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return ApiResponse.error('邮箱和密码不能为空', request.headers.get('Origin'))
    }

    const user = await env.DB.prepare('SELECT id, email, username, avatar, password, salt, is_admin FROM user WHERE email = ?')
      .bind(email).first()

    if (!user) {
      return ApiResponse.error('邮箱或密码错误', request.headers.get('Origin'))
    }

    if (!user.password || !user.salt) {
      return ApiResponse.error('该账号未设置密码，请使用验证码登录', request.headers.get('Origin'))
    }

    const hashedPassword = await hashPassword(password, user.salt)
    if (hashedPassword !== user.password) {
      return ApiResponse.error('邮箱或密码错误', request.headers.get('Origin'))
    }

    const now = new Date().toISOString()
    await env.DB.prepare('UPDATE user SET last_login = ? WHERE id = ?')
      .bind(now, user.id).run()

    const token = await signJWT(
      {
        uid: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        is_admin: user.is_admin ? 1 : 0,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
      },
      env.JWT_SECRET
    )

    return ApiResponse.success({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        is_admin: user.is_admin ? 1 : 0
      },
      message: '登录成功'
    }, request.headers.get('Origin'))

  } catch (error) {
    console.error('Email password login error:', error)
    return ApiResponse.error('登录失败', request.headers.get('Origin'), 500)
  }
}
