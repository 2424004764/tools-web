import { ApiResponse } from '../utils/db.js'
import { verifyCode, verifyCodeRejection } from './send-verification-code.js'
import { hashPassword } from '../utils/password.js'
import { getClientIp, hitLimit, fmtWaitSec } from '../utils/rate-limit.js'

// 单 IP 每小时最多 10 次重置尝试（验证码爆破由 verifyCode 尝试上限拦截）
const IP_RESET_LIMIT = 10
const IP_RESET_WINDOW_SEC = 3600

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'), 405)
  }

  try {
    const { email: rawEmail, code, newPassword } = await request.json()

    // 邮箱统一小写查找，防止大小写变体绕过账号匹配
    const email = String(rawEmail || '').trim().toLowerCase()

    if (!email || !code || !newPassword) {
      return ApiResponse.error('参数不完整', request.headers.get('Origin'), 400)
    }

    if (newPassword.length < 6) {
      return ApiResponse.error('密码至少6位', request.headers.get('Origin'), 400)
    }

    // IP 级重置频控（在验证码校验前拦截）
    const ip = getClientIp(request)
    if (ip) {
      const r = await hitLimit(env.VERIFICATION_CODES, `rl:reset:${ip}`, IP_RESET_LIMIT, IP_RESET_WINDOW_SEC)
      if (!r.allowed) {
        return ApiResponse.error(`操作过于频繁，请 ${fmtWaitSec(r.retryAfterSec)}后再试`, request.headers.get('Origin'), 429, null, {
          'Retry-After': String(r.retryAfterSec)
        })
      }
    }

    // 验证验证码（错误尝试计数存 D1 原子自增，达上限作废并返回 429）
    const verifyResult = await verifyCode(env, email, 'reset', code)
    if (!verifyResult.ok) {
      return verifyCodeRejection(verifyResult, request.headers.get('Origin'))
    }

    // 检查用户是否存在，并获取盐（NOCASE 兼容历史大小写混用的存量数据）
    const user = await env.DB.prepare('SELECT id, salt FROM user WHERE email = ? COLLATE NOCASE').bind(email).first()
    if (!user) {
      return ApiResponse.error('用户不存在', request.headers.get('Origin'), 404)
    }

    // 更新密码（验证码登录自动注册的账号 salt 为空，需补生成盐并一并写入，
    // 否则密码登录会因 salt 为空误判为"未设置密码"）。
    // PBKDF2 哈希 + token_version 递增：重置后所有旧设备的登录态立即失效
    const { salt, hash: hashedPassword } = await hashPassword(newPassword, user.salt || crypto.randomUUID())
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE user SET password = ?, salt = ?, last_login = ?, token_version = token_version + 1 WHERE id = ?',
      ).bind(hashedPassword, salt, now, user.id),
      env.DB.prepare('UPDATE oauth_access_tokens SET revoked = 1 WHERE user_id = ?').bind(user.id),
      env.DB.prepare('UPDATE oauth_refresh_tokens SET revoked = 1 WHERE user_id = ?').bind(user.id),
    ])

    return ApiResponse.success({ message: '密码重置成功' }, request.headers.get('Origin'))
  } catch (error) {
    console.error('Reset password error:', error)
    return ApiResponse.error('密码重置失败', request.headers.get('Origin'), 500)
  }
}
