// Admin 单个工具更新 API
// PUT /api/admin/tools/:id
// body: { is_enabled?: 0|1, sort_order?: number, description?: string, title?: string }
//
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
  if (request.method !== 'PUT') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const id = context.params?.id
  if (!id) return jsonError('缺少工具 id', 400)

  const body = await request.json().catch(() => ({}))

  const sets = []
  const args = []
  if (body.is_enabled !== undefined) {
    sets.push('is_enabled = ?')
    args.push(body.is_enabled === 1 || body.is_enabled === true ? 1 : 0)
  }
  if (body.sort_order !== undefined) {
    const n = parseInt(body.sort_order, 10)
    if (!Number.isInteger(n)) return jsonError('sort_order 必须是整数', 400)
    sets.push('sort_order = ?')
    args.push(n)
  }
  if (body.description !== undefined) {
    sets.push('description = ?')
    args.push(String(body.description).slice(0, 500))
  }
  if (body.title !== undefined) {
    sets.push('title = ?')
    args.push(String(body.title).slice(0, 100))
  }
  if (body.logo !== undefined) {
    sets.push('logo = ?')
    args.push(String(body.logo).slice(0, 200))
  }
  if (body.credit_cost !== undefined) {
    const c = Number(body.credit_cost)
    if (!Number.isInteger(c) || c < 0 || c > 999999) {
      return jsonError('credit_cost 必须是 0~999999 的非负整数', 400)
    }
    sets.push('credit_cost = ?')
    args.push(c)
  }

  if (sets.length === 0) return jsonError('没有要更新的字段', 400)

  sets.push('updated_at = ?')
  args.push(new Date().toISOString().slice(0, 19).replace('T', ' '))
  args.push(id)

  try {
    const result = await db
      .prepare(`UPDATE tool_features SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...args)
      .run()

    const changes = result.meta?.changes ?? result.changes ?? 0
    if (changes === 0) return jsonError('工具不存在', 404)

    // 返回最新行
    const row = await db
      .prepare(
        `SELECT id, title, url, category_id, category_name, description, logo,
                sort_order, is_enabled, credit_cost, created_at, updated_at
         FROM tool_features WHERE id = ?`,
      )
      .bind(id)
      .first()

    return json(row)
  } catch (error) {
    console.error('admin/tools/[id] update error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}