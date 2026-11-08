import { ApiResponse } from '../utils/db.js'
import { verifyPassword, hashPassword } from '../utils/password.js'
import { getClientIp, hitLimit, getLockRemaining, recordAuthFail, clearAuthFails, fmtWaitSec } from '../utils/rate-limit.js'
import { MAIN_JWT_TTL_SECONDS } from '../config/auth.js'

// ===== 登录防爆破参数（三层，兼顾防爆破与防锁号 DoS）=====
// ① 账号+IP 对：连续失败 5 次 → 「该来源 IP 对该账号」锁 15 分钟。
//    只锁攻击者自己所在的组合，受害者从自己的网络照常登录——
//    消除旧设计（按账号整体锁）里"错 5 次即可锁死任意人账号"的 DoS 面。
// ② 账号全局预算：15 分钟窗口内跨 IP 累计失败 50 次 → 账号整体锁 15 分钟。
//    封堵换 IP 的分布式爆破：每个 IP 被①限到 5 次后即自身锁死、不再计数，
//    攻击者要触发②必须烧掉 10 个不同 IP，锁号成本从"1 人 10 秒"抬高一个量级。
// ③ 单 IP 全账号：每 10 分钟最多 30 次密码尝试（防撞库扫描，账号无关）。
const PAIR_MAX_FAILS = 5
const PAIR_LOCK_SEC = 15 * 60
const GLOBAL_MAX_FAILS = 50
const GLOBAL_LOCK_SEC = 15 * 60
const IP_LOGIN_LIMIT = 30
const IP_LOGIN_WINDOW_SEC = 600

// 429 响应（带 Retry-After，前端按 error 字段弹提示）
const tooMany = (message, origin, retryAfterSec) =>
  ApiResponse.error(message, origin, 429, null, { 'Retry-After': String(retryAfterSec) })

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
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'), 405)
  }

  try {
    const { email: rawEmail, password } = await request.json()

    // 邮箱统一小写：锁定键与查库使用同一归一化值，大小写变体不能绕过失败计数
    const email = String(rawEmail || '').trim().toLowerCase()

    if (!email || !password) {
      return ApiResponse.error('邮箱和密码不能为空', request.headers.get('Origin'), 400)
    }

    // ===== 防爆破：对级锁定 + 账号全局锁定 + IP 级限流（在查库前拦截）=====
    // 失败计数按小写邮箱累计：无论账号是否存在都计（含"邮箱不存在"分支），
    // 避免攻击者借锁定行为差异枚举已注册邮箱。
    // 本地 dev / 无 CF-Connecting-IP 时 ip 为 null，对级键退化到固定来源 'noip'。
    const ip = getClientIp(request)
    const failPairKey = `rl:pwfail:${email.toLowerCase()}:ip:${ip || 'noip'}`
    const failGlobalKey = `rl:pwfail:${email.toLowerCase()}`

    const pairLockSec = await getLockRemaining(env.VERIFICATION_CODES, failPairKey)
    if (pairLockSec) {
      // 只锁当前来源，不提示"账号已锁定"（账号本身并未被锁）
      return tooMany(`失败次数过多，请 ${fmtWaitSec(pairLockSec)}后再试`, request.headers.get('Origin'), pairLockSec)
    }
    const globalLockSec = await getLockRemaining(env.VERIFICATION_CODES, failGlobalKey)
    if (globalLockSec) {
      return tooMany(`该账号失败次数过多，已临时锁定，请 ${fmtWaitSec(globalLockSec)}后再试`, request.headers.get('Origin'), globalLockSec)
    }
    if (ip) {
      const r = await hitLimit(env.VERIFICATION_CODES, `rl:pwlogin:${ip}`, IP_LOGIN_LIMIT, IP_LOGIN_WINDOW_SEC)
      if (!r.allowed) {
        return tooMany(`尝试过于频繁，请 ${fmtWaitSec(r.retryAfterSec)}后再试`, request.headers.get('Origin'), r.retryAfterSec)
      }
    }

    const user = await env.DB.prepare(
      'SELECT id, email, username, avatar, password, salt, is_admin, is_disabled, token_version FROM user WHERE email = ? COLLATE NOCASE'
    ).bind(email).first()

    if (!user) {
      await recordAuthFail(env.VERIFICATION_CODES, failPairKey, PAIR_MAX_FAILS, PAIR_LOCK_SEC)
      await recordAuthFail(env.VERIFICATION_CODES, failGlobalKey, GLOBAL_MAX_FAILS, GLOBAL_LOCK_SEC)
      return ApiResponse.error('邮箱或密码错误', request.headers.get('Origin'), 401)
    }

    if (user.is_disabled) {
      return ApiResponse.error('该账号已被禁用，如有疑问请联系站长', request.headers.get('Origin'), 403)
    }

    if (!user.password || !user.salt) {
      return ApiResponse.error('该账号未设置密码，请使用验证码登录', request.headers.get('Origin'), 401)
    }

    const check = await verifyPassword(password, user.password, user.salt)
    if (!check.valid) {
      await recordAuthFail(env.VERIFICATION_CODES, failPairKey, PAIR_MAX_FAILS, PAIR_LOCK_SEC)
      const globalLockedSec = await recordAuthFail(env.VERIFICATION_CODES, failGlobalKey, GLOBAL_MAX_FAILS, GLOBAL_LOCK_SEC)
      if (globalLockedSec) {
        return tooMany(`密码错误次数过多，账号已临时锁定，请 ${fmtWaitSec(globalLockedSec)}后再试`, request.headers.get('Origin'), globalLockedSec)
      }
      return ApiResponse.error('邮箱或密码错误', request.headers.get('Origin'), 401)
    }

    // 命中旧 SHA-256 格式：透明升级为 PBKDF2（用户无感知，存量账号逐步迁移）
    if (check.legacy) {
      try {
        const upgraded = await hashPassword(password)
        await env.DB.prepare('UPDATE user SET password = ?, salt = ? WHERE id = ?')
          .bind(upgraded.hash, upgraded.salt, user.id).run()
      } catch (e) {
        console.error('Password upgrade failed:', e) // 升级失败不阻塞登录，下次登录再试
      }
    }

    // 登录成功，清空对级与全局失败计数
    await clearAuthFails(env.VERIFICATION_CODES, failPairKey)
    await clearAuthFails(env.VERIFICATION_CODES, failGlobalKey)

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await env.DB.prepare('UPDATE user SET last_login = ? WHERE id = ?')
      .bind(now, user.id).run()

    const token = await signJWT(
      {
        uid: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        is_admin: user.is_admin ? 1 : 0,
        ver: user.token_version || 0,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + MAIN_JWT_TTL_SECONDS
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
