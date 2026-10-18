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
        where.push('t.category_id = ?')
        args.push(cid)
      }
    }
    if (enabled === '0' || enabled === '1') {
      where.push('t.is_enabled = ?')
      args.push(parseInt(enabled, 10))
    }
    if (keyword) {
      where.push('(t.title LIKE ? OR t.url LIKE ? OR t.description LIKE ?)')
      const like = `%${keyword}%`
      args.push(like, like, like)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM tool_features t ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT t.id, t.title, t.url, t.category_id,
                COALESCE(c.name, t.category_name, '其他') AS category_name,
                t.description, t.logo,
                t.sort_order, t.is_enabled, t.credit_cost, t.created_at, t.updated_at
         FROM tool_features t
         LEFT JOIN tool_categories c ON c.id = t.category_id
         ${whereSql}
         ORDER BY COALESCE(c.sort_order, 9999) ASC, t.category_id ASC, t.sort_order ASC, t.id ASC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    // 分类聚合信息来自 tool_categories 表（支持独立排序/改名），未关联工具的分类也返回
    const categories = await db
      .prepare(
        `SELECT c.id AS category_id, c.name AS category_name, c.sort_order, c.is_enabled,
                COUNT(t.id) AS total,
                COALESCE(SUM(t.is_enabled = 1), 0) AS enabled
         FROM tool_categories c
         LEFT JOIN tool_features t ON t.category_id = c.id
         GROUP BY c.id, c.name, c.sort_order, c.is_enabled
         ORDER BY c.sort_order ASC, c.id ASC`,
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