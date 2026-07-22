// Admin 工具列表 API
// GET /api/admin/tools?categoryId=2&enabled=0|1&keyword=xxx&page=1&pageSize=50
// 默认按 category_id, sort_order 排序，便于管理员浏览
//
// 鉴权已在 _middleware.js 完成。

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

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 50))
  const categoryId = url.searchParams.get('categoryId')
  const enabled = url.searchParams.get('enabled')
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const offset = (page - 1) * pageSize

  try {
    const where = []
    const args = []
    if (categoryId) {
      const cid = parseInt(categoryId, 10)
      if (!Number.isNaN(cid)) {
        where.push('category_id = ?')
        args.push(cid)
      }
    }
    if (enabled === '0' || enabled === '1') {
      where.push('is_enabled = ?')
      args.push(parseInt(enabled, 10))
    }
    if (keyword) {
      where.push('(title LIKE ? OR url LIKE ? OR description LIKE ?)')
      const like = `%${keyword}%`
      args.push(like, like, like)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM tool_features ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT id, title, url, category_id, category_name, description, logo,
                sort_order, is_enabled, created_at, updated_at
         FROM tool_features
         ${whereSql}
         ORDER BY category_id ASC, sort_order ASC, id ASC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    // 同时返回分类聚合信息，方便管理界面折叠展示
    const categories = await db
      .prepare(
        `SELECT category_id, category_name,
                COUNT(*) AS total,
                SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) AS enabled
         FROM tool_features
         GROUP BY category_id, category_name
         ORDER BY category_id ASC`,
      )
      .all()

    const totalPages = Math.ceil(total / pageSize)

    return json({
      list: list.results || [],
      categories: categories.results || [],
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
    console.error('admin/tools list error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}