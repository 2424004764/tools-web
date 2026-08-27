// Admin 用户管理 API
// GET  /api/admin/users?page=&pageSize=&keyword=&disabled=  用户分页列表
// POST /api/admin/users    { email, username, password?, is_admin? }  手动创建用户
//
// 鉴权：上游 functions/api/admin/_middleware.js 已校验 Bearer JWT + is_admin=1

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// 本地 UTC+8 当天 00:00 的秒级时间戳（与 functions/api/admin/tool-usage.js 保持一致）
function startOfTodayUTC8() {
  const now = new Date()
  const utc8Now = new Date(now.getTime() + 8 * 3600 * 1000)
  const startUTC8 = new Date(
    Date.UTC(utc8Now.getUTCFullYear(), utc8Now.getUTCMonth(), utc8Now.getUTCDate(), 0, 0, 0),
  )
  return Math.floor((startUTC8.getTime() - 8 * 3600 * 1000) / 1000)
}

// 与 email-register.js / reset-password.js 保持一致的密码哈希：SHA-256(password + salt) → 小写十六进制
async function hashPassword(password, salt) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// 生成 10 位 [a-z0-9] 随机密码（前端生成器字符集/长度必须与此处严格一致）
function generatePassword(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let pwd = ''
  for (let i = 0; i < length; i++) pwd += chars[bytes[i] % chars.length]
  return pwd
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function onRequest(context) {
  const { request } = context
  if (request.method === 'GET') return onRequestGet(context)
  if (request.method === 'POST') return onRequestPost(context)
  return jsonError('不支持的请求方法', 405)
}

async function onRequestGet(context) {
  const { request, env } = context

  const db = env.DB
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const disabled = url.searchParams.get('disabled') // '0' | '1' | null
  const offset = (page - 1) * pageSize

  try {
    // 构造 WHERE 子句
    const where = []
    const params = []
    if (keyword) {
      where.push('(email LIKE ? OR username LIKE ? OR id LIKE ?)')
      const like = `%${keyword}%`
      params.push(like, like, like)
    }
    if (disabled === '0' || disabled === '1') {
      where.push('is_disabled = ?')
      params.push(parseInt(disabled, 10))
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    // 总数
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM user ${whereSql}`)
      .bind(...params)
      .first()
    const total = totalRow?.c || 0

    // 列表（LEFT JOIN 积分表，缺失积分记录的用户余额=0）
    const list = await db
      .prepare(
        `SELECT u.id, u.email, u.username, u.avatar, u.is_admin, u.is_disabled,
                u.disabled_reason, u.disabled_at, u.created_at, u.last_login,
                COALESCE(c.balance, 0) AS credits_balance,
                COALESCE(c.total_earned, 0) AS credits_earned,
                COALESCE(c.total_spent, 0) AS credits_spent
         FROM user u
         LEFT JOIN user_credits c ON c.uid = u.id
         ${whereSql}
         ORDER BY u.created_at DESC, u.id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, pageSize, offset)
      .all()

    const totalPages = Math.ceil(total / pageSize)

    // 当前页 uid 列表 → 今日工具使用聚合（DISTINCT tool_url 为「使用工具个数」，
    //   COUNT(*) 为「使用次数」）。一次查询多行，避免每行 correlated subquery。
    // 同时聚合今日每个工具的使用次数（用于悬浮显示具体工具列表）。
    let rows = list.results || []
    if (rows.length > 0) {
      const uids = rows.map((r) => r.id)
      const placeholders = uids.map(() => '?').join(',')
      const todayStart = startOfTodayUTC8()
      const usageResult = await db
        .prepare(
          `SELECT uid,
                  COUNT(DISTINCT tool_url) AS tool_count,
                  COUNT(*)              AS use_count
           FROM tool_usage_records
           WHERE uid IN (${placeholders}) AND used_at >= ?
           GROUP BY uid`,
        )
        .bind(...uids, todayStart)
        .all()
      const usageMap = new Map(
        (usageResult.results || []).map((u) => [u.uid, u]),
      )

      // 今日具体工具列表（按 use_count 倒序；悬浮 popover 用）
      const toolsResult = await db
        .prepare(
          `SELECT uid, tool_url, tool_title, COUNT(*) AS use_count
           FROM tool_usage_records
           WHERE uid IN (${placeholders}) AND used_at >= ?
           GROUP BY uid, tool_url, tool_title
           ORDER BY use_count DESC`,
        )
        .bind(...uids, todayStart)
        .all()
      const toolsMap = new Map()
      for (const t of toolsResult.results || []) {
        if (!toolsMap.has(t.uid)) toolsMap.set(t.uid, [])
        toolsMap.get(t.uid).push({
          tool_url: t.tool_url,
          tool_title: t.tool_title,
          use_count: t.use_count,
        })
      }

      // 注册位置与注册 IP：取该用户最早一条 tool_usage_records 的 country / city / ip
      // 作为「注册位置」与「注册 IP」（大多数用户首次进入工具就是注册后立即使用；无记录则 null）。
      // ip 列由 migrations/051_add_tool_usage_ip.sql 引入，旧记录可能为 NULL。
      const locationResult = await db
        .prepare(
          `SELECT uid, country, city, ip
           FROM tool_usage_records
           WHERE uid IN (${placeholders})
             AND (country IS NOT NULL OR city IS NOT NULL OR ip IS NOT NULL)
           GROUP BY uid
           HAVING used_at = MIN(used_at)`,
        )
        .bind(...uids)
        .all()
      const locationMap = new Map(
        (locationResult.results || []).map((l) => [l.uid, l]),
      )

      rows = rows.map((r) => {
        const u = usageMap.get(r.id)
        const loc = locationMap.get(r.id)
        return {
          ...r,
          today_tool_count: u?.tool_count ?? 0,
          today_usage_count: u?.use_count ?? 0,
          today_tools: toolsMap.get(r.id) || [],
          register_country: loc?.country ?? null,
          register_city: loc?.city ?? null,
          register_ip: loc?.ip ?? null,
        }
      })
    }

    return json({
      list: rows,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('admin/users list error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}

// ============ POST：手动创建用户 ============
async function onRequestPost(context) {
  const { request, env } = context
  const db = env.DB

  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('请求体必须是合法 JSON', 400)
  }

  const { email, username, password, is_admin } = body || {}

  // 1) 必填校验
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return jsonError('邮箱格式不正确', 400)
  }
  if (!username || typeof username !== 'string' || !username.trim()) {
    return jsonError('用户名不能为空', 400)
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = username.trim()
  const wantAdmin = is_admin === true || is_admin === 1 || is_admin === '1'

  try {
    // 2) 邮箱唯一性
    const existing = await db
      .prepare('SELECT id FROM user WHERE email = ? LIMIT 1')
      .bind(normalizedEmail)
      .first()
    if (existing) {
      return jsonError('该邮箱已被注册', 409)
    }

    // 3) 密码：可选 -> 留空时后端兜底生成 10 位 [a-z0-9]
    let finalPassword = ''
    let passwordGenerated = false
    if (typeof password === 'string' && password.length > 0) {
      if (password.length < 6) {
        return jsonError('密码至少 6 位', 400)
      }
      finalPassword = password
    } else {
      finalPassword = generatePassword(10)
      passwordGenerated = true
    }

    // 4) 哈希（与 email-register.js 等保持一致）
    const salt = crypto.randomUUID()
    const hashedPassword = await hashPassword(finalPassword, salt)

    // 5) INSERT 全字段
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO user (
          id, email, username, password, salt, avatar,
          is_admin, is_disabled, user_level,
          created_at, last_login
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        normalizedEmail,
        normalizedUsername,
        hashedPassword,
        salt,
        '',
        wantAdmin ? 1 : 0,
        0,
        0,
        now,
        now,
      )
      .run()

    // 6) 返回
    const payload = {
      id,
      email: normalizedEmail,
      username: normalizedUsername,
      is_admin: wantAdmin,
    }
    if (passwordGenerated) {
      payload.generated_password = finalPassword
    }
    return json(payload, 201)
  } catch (error) {
    console.error('admin/users create error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}