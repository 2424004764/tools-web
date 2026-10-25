import { ApiResponse } from '../utils/db.js'
import { attachUpstreamError } from '../utils/error-log.js'
import { getClientIp, hitLimit, fmtWaitSec } from '../utils/rate-limit.js'

// 生成6位数字验证码（CSPRNG；Math.random 可预测，不该用于安全值）
const generateCode = () => {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(100000 + (buf[0] % 900000))
}

// ===== 发送频控参数（防邮件轰炸 / 验证码轰炸）=====
// 同一邮箱+类型 60s 发送冷却
const SEND_COOLDOWN_MS = 60 * 1000
// 单邮箱：5 次/小时、10 次/天；单 IP：15 次/小时、30 次/天
// （IP 从 CF-Connecting-IP 取，邮箱统一转小写后再入键，防止大小写变体绕过计数）
const EMAIL_HOURLY = 5
const EMAIL_DAILY = 10
const IP_HOURLY = 15
const IP_DAILY = 30

// 单个验证码最多允许的错误尝试次数，达到即作废（防 6 位码爆破）
const MAX_VERIFY_TRIES = 5

/**
 * 发送邮件通过 Resend。
 * 失败时返回 { ok:false, status, body } 而非仅 false，
 * 方便调用方把上游真实状态码与响应体挂到 context.data.__upstreamError
 * 上，由全局中间件落库到 api_error_logs。
 */
const sendEmail = async (to, subject, text, html, apiKey, fromEmail) => {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html
      })
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      console.error('Resend failed:', response.status, errBody)
      return { ok: false, status: response.status, body: errBody }
    }
    return { ok: true }
  } catch (error) {
    console.error('Resend error:', error)
    return { ok: false, status: 0, body: String(error?.message || error) }
  }
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'), 405)
  }

  try {
    const { email, type } = await request.json() // type: register / login / reset

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ApiResponse.error('邮箱格式不正确', request.headers.get('Origin'), 400)
    }

    if (!['register', 'login', 'reset'].includes(type)) {
      return ApiResponse.error('类型参数错误', request.headers.get('Origin'), 400)
    }

    // KV 绑定检查前移：冷却与频控都依赖 KV
    if (!env.VERIFICATION_CODES) {
      attachUpstreamError(context, { stage: 'kv', extra: { email, type, reason: 'kv_binding_missing' } })
      return ApiResponse.error('验证码服务未配置（缺少 VERIFICATION_CODES 绑定）', request.headers.get('Origin'), 500)
    }

    // ===== 频控：放在所有 DB 查询之前，滥用请求不消耗数据库 =====
    // 验证码键与频控键统一用小写邮箱：大小写变体不能各自独立计数/冷却，
    // 也不能借变体绕过"该邮箱已注册"检查重复注册
    const vcodeKey = `vcode:${email.toLowerCase()}:${type}`
    const emailKey = email.toLowerCase()
    const ip = getClientIp(request)

    // ① 同邮箱+类型 60s 发送冷却（读取上一封验证码的 sentAt；重发会覆盖旧码，共用键无冲突）
    let prev = null
    try {
      prev = await env.VERIFICATION_CODES.get(vcodeKey, { type: 'json' })
    } catch (e) { /* 读失败按无冷却处理 */ }
    if (prev && typeof prev.sentAt === 'number' && Date.now() - prev.sentAt < SEND_COOLDOWN_MS) {
      const wait = Math.ceil((SEND_COOLDOWN_MS - (Date.now() - prev.sentAt)) / 1000)
      return ApiResponse.error(`发送太频繁，请 ${wait} 秒后再试`, request.headers.get('Origin'), 429, null, {
        'Retry-After': String(wait)
      })
    }

    // ② 单邮箱频控（防轰炸同一收件箱）+ ③ 单 IP 频控（防换邮箱轰炸他人）
    const limits = [
      await hitLimit(env.VERIFICATION_CODES, `rl:send:em:h:${emailKey}`, EMAIL_HOURLY, 3600),
      await hitLimit(env.VERIFICATION_CODES, `rl:send:em:d:${emailKey}`, EMAIL_DAILY, 86400),
    ]
    if (ip) {
      limits.push(
        await hitLimit(env.VERIFICATION_CODES, `rl:send:ip:h:${ip}`, IP_HOURLY, 3600),
        await hitLimit(env.VERIFICATION_CODES, `rl:send:ip:d:${ip}`, IP_DAILY, 86400)
      )
    }
    const limited = limits.find((r) => !r.allowed)
    if (limited) {
      return ApiResponse.error(`请求过于频繁，请 ${fmtWaitSec(limited.retryAfterSec)}后再试`, request.headers.get('Origin'), 429, null, {
        'Retry-After': String(limited.retryAfterSec)
      })
    }

    // 检查邮箱是否已注册（仅注册时检查；NOCASE 兼容历史大小写混用的存量数据）
    if (type === 'register') {
      const existing = await env.DB.prepare('SELECT id FROM user WHERE email = ? COLLATE NOCASE').bind(email.toLowerCase()).first()
      if (existing) {
        attachUpstreamError(context, { stage: 'validation', extra: { email, type, reason: 'email_registered' } })
        return ApiResponse.error('该邮箱已注册', request.headers.get('Origin'), 409)
      }
    }

    // 重置密码：邮箱是否已注册不对外区分（防注册状态枚举），未注册时不实际发信，
    // 但返回与已注册一致的通用文案
    let registered = true
    if (type === 'reset') {
      const existing = await env.DB.prepare('SELECT id FROM user WHERE email = ? COLLATE NOCASE').bind(email.toLowerCase()).first()
      if (!existing) {
        attachUpstreamError(context, { stage: 'auth', extra: { email, type, reason: 'email_not_registered' } })
        return ApiResponse.success({ message: '验证码已发送，请查收邮件' }, request.headers.get('Origin'))
      }
    } else if (type === 'login') {
      registered = !!(await env.DB.prepare('SELECT id FROM user WHERE email = ? COLLATE NOCASE').bind(email.toLowerCase()).first())
    }

    // 生成验证码
    const code = generateCode()

    // 存储到 KV（5 分钟 TTL 由 KV 原生 expirationTtl 保证；sentAt 供 60s 冷却判定）
    await env.VERIFICATION_CODES.put(
      vcodeKey,
      JSON.stringify({ code, sentAt: Date.now(), expires: Date.now() + 5 * 60 * 1000 }),
      { expirationTtl: 300 }
    )

    // 发送邮件
    const typeText = { register: '注册', login: '登录', reset: '重置密码' }[type]
    const siteName = env.SITE_NAME || '一方工具箱'
    const subject = `【${siteName}】${typeText}验证码：${code}`
    const text = `您的${typeText}验证码是：${code}，有效期5分钟，请勿泄露。`
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">【${siteName}】${typeText}验证码</h2>
        <p style="font-size: 16px; color: #666;">您正在进行${typeText}操作，验证码为：</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #409EFF; letter-spacing: 5px;">${code}</span>
        </div>
        <p style="font-size: 14px; color: #999;">验证码有效期为5分钟，请勿泄露给他人。</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999;">如非本人操作，请忽略此邮件。</p>
      </div>
    `

    const sent = await sendEmail(email, subject, text, html, env.RESEND_API_KEY, env.RESEND_FROM_EMAIL)

    if (!sent.ok) {
      attachUpstreamError(context, {
        stage: 'upstream',
        upstreamName: 'resend',
        upstreamStatus: sent.status,
        upstreamBody: sent.body,
        extra: { email, type },
      })
      return ApiResponse.error('验证码发送失败，请稍后重试', request.headers.get('Origin'), 500)
    }

    const message = type === 'login' && !registered
      ? '验证码已发送，该邮箱未注册，验证通过后将自动注册'
      : '验证码已发送，请查收邮件'
    return ApiResponse.success({ message }, request.headers.get('Origin'))
  } catch (error) {
    console.error('Send verification code error:', error)
    return ApiResponse.error('服务器错误', request.headers.get('Origin'), 500)
  }
}

// 导出验证码验证函数（供其他 API 使用）
// 注意：此函数依赖 env.VERIFICATION_CODES 绑定；调用方需把 env 一并传入
export const verifyCode = async (env, email, type, code) => {
  // 键统一小写邮箱，与发送侧一致（大小写变体共享同一验证码与尝试计数）
  const key = `vcode:${String(email).toLowerCase()}:${type}`
  if (!env || !env.VERIFICATION_CODES) return false

  let stored
  try {
    stored = await env.VERIFICATION_CODES.get(key, { type: 'json' })
  } catch (e) {
    console.error('KV read failed:', e)
    return false
  }
  if (!stored) return false

  // 防御性过期判断（KV TTL 通常已处理，但加一层防时钟漂移）
  if (Date.now() > stored.expires) {
    await env.VERIFICATION_CODES.delete(key).catch(() => {})
    return false
  }
  if (stored.code !== code) {
    // 错误尝试计数：连错 MAX_VERIFY_TRIES 次直接作废该验证码。
    // 6 位码共 10^6 空间，每次最多猜 5 次，获取新码又被发送频控约束，爆破不可行。
    const tries = ((typeof stored.tries === 'number') ? stored.tries : 0) + 1
    if (tries >= MAX_VERIFY_TRIES) {
      await env.VERIFICATION_CODES.delete(key).catch(() => {})
      return false
    }
    // 写回尝试计数，TTL 取验证码剩余寿命（KV 下限 60s，略长无害——expires 时间戳仍生效）
    const remainSec = Math.max(60, Math.ceil((stored.expires - Date.now()) / 1000))
    await env.VERIFICATION_CODES.put(
      key,
      JSON.stringify({ ...stored, tries }),
      { expirationTtl: remainSec }
    ).catch(() => {})
    return false
  }

  // 验证成功后删除（一次性使用）
  await env.VERIFICATION_CODES.delete(key).catch(() => {})
  return true
}
