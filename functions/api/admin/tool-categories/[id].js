// Admin 单个分类更新 API
// PUT /api/admin/tool-categories/:id
// body: { name?: string, sort_order?: number, is_enabled?: 0|1 }
//
// 分类名称与排序存于 tool_categories 表；工具通过 category_id 关联，
// 前台 /api/tools 与后台工具列表均 JOIN 本表取名称与排序。
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
  if (request.method !== 'PUT') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const id = parseInt(context.params?.id, 10)
  if (!Number.isInteger(id)) return jsonError('缺少分类 id', 400)

  const body = await request.json().catch(() => ({}))

  const sets = []
  const args = []
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return jsonError('分类名称不能为空', 400)
    if (name.length > 20) return jsonError('分类名称不能超过 20 个字符', 400)
    sets.push('name = ?')
    args.push(name)
  }
  if (body.sort_order !== undefined) {
    const n = parseInt(body.sort_order, 10)
    if (!Number.isInteger(n)) return jsonError('sort_order 必须是整数', 400)
    sets.push('sort_order = ?')
    args.push(n)
  }
  if (body.is_enabled !== undefined) {
    sets.push('is_enabled = ?')
    args.push(body.is_enabled === 1 || body.is_enabled === true ? 1 : 0)
  }

  if (sets.length === 0) return jsonError('没有要更新的字段', 400)

  sets.push('updated_at = datetime(\'now\', \'localtime\')')
  args.push(id)

  try {
    const result = await db
      .prepare(`UPDATE tool_categories SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...args)
      .run()

    const changes = result.meta?.changes ?? result.changes ?? 0
    if (changes === 0) return jsonError('分类不存在', 404)

    // 改名时同步 tool_features 的冗余名称列，保持旧读取路径一致
    if (body.name !== undefined) {
      await db
        .prepare('UPDATE tool_features SET category_name = ? WHERE category_id = ?')
        .bind(String(body.name).trim(), id)
        .run()
    }

    const row = await db
      .prepare('SELECT id, name, sort_order, is_enabled FROM tool_categories WHERE id = ?')
      .bind(id)
      .first()

    return json({ category: row })
  } catch (error) {
    console.error('admin/tool-categories/[id] update error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
