// Admin 工具分类 API
// GET  /api/admin/tool-categories  分类列表（含工具计数，按 sort_order 排序）
// POST /api/admin/tool-categories 新建分类 { name, sort_order? }
//
// 鉴权已在 _middleware.js 完成。

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

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env.DB

  try {
    if (request.method === 'GET') {
      const categories = await db
        .prepare(
          `SELECT c.id, c.name, c.sort_order, c.is_enabled,
                  COUNT(t.id) AS total,
                  COALESCE(SUM(t.is_enabled = 1), 0) AS enabled
           FROM tool_categories c
           LEFT JOIN tool_features t ON t.category_id = c.id
           GROUP BY c.id, c.name, c.sort_order, c.is_enabled
           ORDER BY c.sort_order ASC, c.id ASC`,
        )
        .all()
      return json({ categories: categories.results || [] })
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const name = String(body.name || '').trim()
      if (!name) return jsonError('分类名称不能为空', 400)
      if (name.length > 20) return jsonError('分类名称不能超过 20 个字符', 400)

      // 新分类默认排在已有分类之后（当前最大 sort_order + 10）
      const maxRow = await db
        .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM tool_categories')
        .first()
      const sortOrder = Number.isInteger(parseInt(body.sort_order, 10))
        ? parseInt(body.sort_order, 10)
        : (maxRow?.m || 0) + 10

      const result = await db
        .prepare('INSERT INTO tool_categories (name, sort_order) VALUES (?, ?)')
        .bind(name, sortOrder)
        .run()

      const row = await db
        .prepare('SELECT id, name, sort_order, is_enabled FROM tool_categories WHERE id = ?')
        .bind(result.meta?.last_row_id)
        .first()

      return json({ category: row }, 201)
    }

    return jsonError('不支持的请求方法', 405)
  } catch (error) {
    console.error('admin/tool-categories error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
