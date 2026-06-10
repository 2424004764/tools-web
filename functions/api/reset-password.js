import { ApiResponse } from '../utils/db.js'
import { verifyCode } from './send-verification-code.js'

// 密码加盐哈希
const hashPassword = async (password, salt) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'))
  }

  try {
    const { email, code, newPassword } = await request.json()

    if (!email || !code || !newPassword) {
      return ApiResponse.error('参数不完整', request.headers.get('Origin'))
    }

    if (newPassword.length < 6) {
      return ApiResponse.error('密码至少6位', request.headers.get('Origin'))
    }

    // 验证验证码
    if (!verifyCode(email, 'reset', code)) {
      return ApiResponse.error('验证码错误或已过期', request.headers.get('Origin'))
    }

    // 检查用户是否存在，并获取盐
    const user = await env.DB.prepare('SELECT id, salt FROM user WHERE email = ?').bind(email).first()
    if (!user) {
      return ApiResponse.error('用户不存在', request.headers.get('Origin'))
    }

    // 更新密码
    const hashedPassword = await hashPassword(newPassword, user.salt)
    const now = new Date().toISOString()
    await env.DB.prepare('UPDATE user SET password = ?, last_login = ? WHERE email = ?')
      .bind(hashedPassword, now, email).run()

    return ApiResponse.success({ message: '密码重置成功' }, request.headers.get('Origin'))
  } catch (error) {
    console.error('Reset password error:', error)
    return ApiResponse.error('密码重置失败', request.headers.get('Origin'), 500)
  }
}
