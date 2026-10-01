// Admin 用户改密
// PUT /api/admin/users/:uid/password  body: { password? }
//
// 仅限「邮箱 + 密码」注册的用户（user.password 非空）；Google/GitHub 等第三方登录
// 用户没有密码字段，后端直接拒绝（前端也按 has_password 隐藏入口）。
// password 留空时由后端生成 10 位 [a-z0-9] 随机密码，仅在返回体 generated_password
// 中返回一次（与创建用户接口的约定一致）。
// 哈希方式与 email-register.js / reset-password.js 保持一致：SHA-256(password + salt) → 小写十六进制。
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// 生成 10 位 [a-z0-9] 随机密码（与 admin/users/index.js 创建用户保持一致）
function generatePassword(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let pwd = ''
  for (let i = 0; i < length; i++) pwd += chars[bytes[i] % chars.length]
  return pwd
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'PUT') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = context.params?.uid
  if (!uid) return jsonError('缺少用户 id')

  const body = await request.json().catch(() => ({}))
  let password = typeof body?.password === 'string' ? body.password.trim() : ''
  if (password && password.length < 6) return jsonError('密码至少 6 位')
  if (password.length > 64) return jsonError('密码最多 64 位')

  try {
    const existing = await db
      .prepare(
        `SELECT id, email, username,
                (password IS NOT NULL AND password != '') AS has_password
         FROM user WHERE id = ?`,
      )
      .bind(uid)
      .first()
    if (!existing) return jsonError('用户不存在', 404)

    if (!existing.has_password) {
      return jsonError('该用户使用第三方登录（如 Google），未设置过密码，无法修改密码')
    }

    let generated = ''
    if (!password) {
      password = generatePassword(10)
      generated = password
    }

    const salt = crypto.randomUUID()
    const hashed = await hashPassword(password, salt)
    await db
      .prepare('UPDATE user SET password = ?, salt = ? WHERE id = ?')
      .bind(hashed, salt, uid)
      .run()

    console.log(
      `[admin/users password] uid=${uid} email=${existing.email} by adminUid=${context.data?.adminUid || '-'}`,
    )

    const payload = { id: uid, updated: true }
    if (generated) payload.generated_password = generated
    return json(payload)
  } catch (error) {
    console.error('admin/users password error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
