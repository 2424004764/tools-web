import { ApiResponse } from '../utils/db.js'

// 验证码存储（使用 KV 或临时内存，这里用内存演示，生产环境应使用 KV）
const verificationCodes = new Map()

// 生成6位数字验证码
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString()

// 发送邮件通过 Resend
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

    return response.ok
  } catch (error) {
    console.error('Resend error:', error)
    return false
  }
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'))
  }

  try {
    const { email, type } = await request.json() // type: register / login / reset

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ApiResponse.error('邮箱格式不正确', request.headers.get('Origin'))
    }

    if (!['register', 'login', 'reset'].includes(type)) {
      return ApiResponse.error('类型参数错误', request.headers.get('Origin'))
    }

    // 检查邮箱是否已注册（仅注册时检查）
    if (type === 'register') {
      const existing = await env.DB.prepare('SELECT id FROM user WHERE email = ?').bind(email).first()
      if (existing) {
        return ApiResponse.error('该邮箱已注册', request.headers.get('Origin'))
      }
    }

    // 检查邮箱是否存在（登录和重置密码时检查）
    if (type === 'login' || type === 'reset') {
      const existing = await env.DB.prepare('SELECT id FROM user WHERE email = ?').bind(email).first()
      if (!existing) {
        return ApiResponse.error('该邮箱未注册', request.headers.get('Origin'))
      }
    }

    // 生成验证码
    const code = generateCode()
    const key = `${email}:${type}`

    // 存储验证码（5分钟有效）
    verificationCodes.set(key, { code, expires: Date.now() + 5 * 60 * 1000 })

    // 发送邮件
    const typeText = { register: '注册', login: '登录', reset: '重置密码' }[type]
    const subject = `【一方工具箱】${typeText}验证码`
    const text = `您的${typeText}验证码是：${code}，有效期5分钟，请勿泄露。`
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">【一方工具箱】${typeText}验证码</h2>
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

    if (!sent) {
      return ApiResponse.error('验证码发送失败，请稍后重试', request.headers.get('Origin'))
    }

    return ApiResponse.success({ message: '验证码已发送，请查收邮件' }, request.headers.get('Origin'))
  } catch (error) {
    console.error('Send verification code error:', error)
    return ApiResponse.error('服务器错误', request.headers.get('Origin'), 500)
  }
}

// 导出验证码验证函数（供其他 API 使用）
export const verifyCode = (email, type, code) => {
  const key = `${email}:${type}`
  const stored = verificationCodes.get(key)

  if (!stored) return false
  if (Date.now() > stored.expires) {
    verificationCodes.delete(key)
    return false
  }
  if (stored.code !== code) return false

  verificationCodes.delete(key) // 验证成功后删除
  return true
}
