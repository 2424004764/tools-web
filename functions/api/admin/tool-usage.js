// Admin 工具使用记录 API
//   GET /api/admin/tool-usage?page=1&pageSize=20&uid=...&tool_url=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//     鉴权：目录中间件 _middleware.js 已保证 admin
//     返回：明细 + 分页
//
// 时间约定：used_at 是秒级时间戳，SQL 内统一用秒比较；
//   startDate/endDate 是 YYYY-MM-DD（本地 UTC+8），被解析为当天的 00:00:00 与次日 00:00:00（含当天）。
//
// 路由说明：本文件精确匹配 /api/admin/tool-usage（GET 明细列表）。
//   子路径 /api/admin/tool-usage/stats 单独走 stats.js，是 Cloudflare Pages Functions 的
//   拆分惯例（与 credits/transactions.js 一致）。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

// 本地 UTC+8 当天 00:00 的秒级时间戳
function startOfTodayUTC8() {
  const now = new Date()
  const utc8Now = new Date(now.getTime() + 8 * 3600 * 1000)
  const startUTC8 = new Date(
    Date.UTC(utc8Now.getUTCFullYear(), utc8Now.getUTCMonth(), utc8Now.getUTCDate(), 0, 0, 0),
  )
  return Math.floor((startUTC8.getTime() - 8 * 3600 * 1000) / 1000)
}

// 把 YYYY-MM-DD 解析为当天 UTC+8 00:00:00 的秒级时间戳；非法返回 null
function parseDateToUTC8Start(s) {
  if (!s || typeof s !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const [, y, mo, d] = m
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, 0, 0)
  return Math.floor((utc - 8 * 3600 * 1000) / 1000)
}

// 把 YYYY-MM-DD 解析为次日 UTC+8 00:00:00 的秒级时间戳（endDate 含当天）
function parseDateToUTC8NextDayStart(s) {
  const start = parseDateToUTC8Start(s)
  if (start == null) return null
  return start + 24 * 3600
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
    const uid = (url.searchParams.get('uid') || '').trim()
    const toolUrl = (url.searchParams.get('tool_url') || '').trim()
    const startDate = parseDateToUTC8Start(url.searchParams.get('startDate'))
    const endDate = parseDateToUTC8NextDayStart(url.searchParams.get('endDate'))

    const where = []
    const args = []
    if (uid) {
      where.push('r.uid = ?')
      args.push(uid)
    }
    if (toolUrl) {
      where.push('r.tool_url = ?')
      args.push(toolUrl)
    }
    if (startDate != null) {
      where.push('r.used_at >= ?')
      args.push(startDate)
    }
    if (endDate != null) {
      where.push('r.used_at < ?')
      args.push(endDate)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM tool_usage_records r ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT r.id, r.uid, r.ip, r.tool_url, r.tool_title, r.used_at,
                u.email AS user_email, u.username AS user_name
         FROM tool_usage_records r
         LEFT JOIN user u ON u.id = r.uid
         ${whereSql}
         ORDER BY r.used_at DESC, r.id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const totalPages = Math.ceil(total / pageSize)

    return json({
      list: list.results || [],
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (err) {
    console.error('[admin/tool-usage] list error:', err)
    return jsonError(err.message || '服务器错误', 500)
  }
}

// 仅接受 GET，其他方法 405
export async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  }
  return onRequestGet(context)
}