// Admin 友情链接列表
// GET /api/admin/friend-links?page=1&pageSize=20&status=pending|approved|rejected&keyword=
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_STATUS = new Set(['pending', 'approved', 'rejected'])

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
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const offset = (page - 1) * pageSize

  try {
    const where = []
    const args = []
    if (status && VALID_STATUS.has(status)) {
      where.push('status = ?')
      args.push(status)
    }
    if (keyword) {
      where.push('(name LIKE ? OR url LIKE ? OR description LIKE ? OR contact LIKE ?)')
      const like = `%${keyword}%`
      args.push(like, like, like, like)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM friend_links ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT id, name, url, description, contact, status, sort_order,
                submit_ip, reject_reason, reviewed_by, reviewed_at, created_at, updated_at
         FROM friend_links
         ${whereSql}
         ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                  sort_order ASC, created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const counts = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
           COUNT(*) AS total
         FROM friend_links`,
      )
      .first()

    const totalPages = Math.ceil(total / pageSize)
    return json({
      list: list.results || [],
      counts: {
        pending: counts?.pending || 0,
        approved: counts?.approved || 0,
        rejected: counts?.rejected || 0,
        total: counts?.total || 0,
      },
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
    console.error('admin friend-links list error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
