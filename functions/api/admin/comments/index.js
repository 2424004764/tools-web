// Admin 评论列表 + 批量审核
// GET /api/admin/comments?page=1&pageSize=20&status=pending|approved|rejected&keyword=
// PUT /api/admin/comments  body: { ids: string[], status: 'approved' | 'rejected' | 'pending' }  批量改状态
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_STATUS = new Set(['pending', 'approved', 'rejected'])
const MAX_BATCH = 200

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

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  // ---- PUT：批量审核（通过 / 拒绝 / 撤回待审） ----
  if (request.method === 'PUT') {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

    const status = String(body.status || '').trim()
    if (!VALID_STATUS.has(status)) return jsonError('status 必须是 pending/approved/rejected', 400)

    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map((id) => String(id || '').trim()).filter(Boolean))]
      : []
    if (!ids.length) return jsonError('ids 不能为空', 400)
    if (ids.length > MAX_BATCH) return jsonError(`单次最多操作 ${MAX_BATCH} 条`, 400)

    try {
      const placeholders = ids.map(() => '?').join(',')
      const result = await db
        .prepare(
          `UPDATE comments
           SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
           WHERE id IN (${placeholders})`,
        )
        .bind(status, context.data?.adminUid || null, ...ids)
        .run()

      return json({ ids, status, updated: result?.meta?.changes ?? 0 })
    } catch (error) {
      console.error('admin comments batch error:', error)
      return jsonError(error.message || '服务器错误', 500)
    }
  }

  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

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
      where.push('(content LIKE ? OR nickname LIKE ? OR email LIKE ? OR page_path LIKE ? OR page_title LIKE ?)')
      const like = `%${keyword}%`
      args.push(like, like, like, like, like)
    }
    // 站长回复（is_admin = 1）保留在列表里（可查看/删除），但不计入分页总数，避免回复后「共 N 条」虚高
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const countSql = `${whereSql}${whereSql ? ' AND' : ' WHERE'} is_admin = 0`

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM comments ${countSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT id, page_path, page_title, content, user_id, nickname, email, avatar,
                status, submit_ip, reviewed_by, reviewed_at, parent_id, is_admin, created_at
         FROM comments
         ${whereSql}
         ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                  created_at DESC
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
         FROM comments
         WHERE is_admin = 0`,
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
    console.error('admin comments list error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
