// Admin 用户反馈列表
// GET /api/admin/feedback?page=1&pageSize=20&status=pending|resolved|closed&type=suggestion|bug|other&keyword=
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_STATUS = new Set(['pending', 'resolved', 'closed'])
const VALID_TYPES = new Set(['suggestion', 'bug', 'other'])

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

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const status = (url.searchParams.get('status') || '').trim()
  const type = (url.searchParams.get('type') || '').trim()
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const offset = (page - 1) * pageSize

  try {
    const where = []
    const args = []
    if (status && VALID_STATUS.has(status)) {
      where.push('status = ?')
      args.push(status)
    }
    if (type && VALID_TYPES.has(type)) {
      where.push('type = ?')
      args.push(type)
    }
    if (keyword) {
      where.push('(content LIKE ? OR contact LIKE ? OR email LIKE ? OR username LIKE ? OR page_url LIKE ?)')
      const like = `%${keyword}%`
      args.push(like, like, like, like, like)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM feedback ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT id, uid, email, username, type, content, contact, page_url,
                user_agent, submit_ip, status, admin_note, reviewed_by, reviewed_at,
                created_at, updated_at
         FROM feedback
         ${whereSql}
         ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const counts = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
           SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
           COUNT(*) AS total
         FROM feedback`,
      )
      .first()

    return json({
      list: list.results || [],
      counts: {
        pending: counts?.pending || 0,
        resolved: counts?.resolved || 0,
        closed: counts?.closed || 0,
        total: counts?.total || 0,
      },
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('admin feedback list error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
