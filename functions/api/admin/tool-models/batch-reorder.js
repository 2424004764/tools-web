// Admin 批量重排 tool_model 顺序 API
// POST /api/admin/tool-models/batch-reorder
// body: { items: [{ id: number, sort_order: number }] }
//
// 用法：拖拽重排后，前端把新顺序的 id+sort_order 一次性提交过来。
// 单次 db.batch 原子写所有行的 sort_order，不存在「排到一半挂掉导致顺序错乱」。
//
// 校验：
//   - items 是数组，1 ~ 200 项
//   - 每项 id 是正整数，sort_order 是非负整数
//   - 所有 id 必须存在（防止前端传错）
//
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

const MAX_ITEMS = 200

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  const body = await request.json().catch(() => ({}))
  const items = body?.items
  if (!Array.isArray(items) || items.length === 0) {
    return jsonError('items 必须是非空数组', 400)
  }
  if (items.length > MAX_ITEMS) {
    return jsonError(`单次最多 ${MAX_ITEMS} 项，当前 ${items.length}`, 400)
  }

  // 校验每一项的 id / sort_order，并去重
  const seen = new Set()
  const cleaned = []
  for (const it of items) {
    const id = parseInt(it?.id, 10)
    const sortOrder = parseInt(it?.sort_order, 10)
    if (!Number.isInteger(id) || id <= 0) {
      return jsonError(`id 必须是正整数，收到：${it?.id}`, 400)
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return jsonError(`sort_order 必须是非负整数，收到：${it?.sort_order}`, 400)
    }
    if (seen.has(id)) continue
    seen.add(id)
    cleaned.push({ id, sortOrder })
  }
  if (cleaned.length === 0) {
    return jsonError('过滤后无有效项', 400)
  }

  try {
    // 校验 id 都存在（一次性 IN 查询）
    const placeholders = cleaned.map(() => '?').join(',')
    const existing = await db
      .prepare(`SELECT id FROM tool_models WHERE id IN (${placeholders})`)
      .bind(...cleaned.map((x) => x.id))
      .all()
    const existingIds = new Set((existing.results || []).map((r) => r.id))
    const missing = cleaned.filter((x) => !existingIds.has(x.id))
    if (missing.length > 0) {
      return jsonError(
        `以下 id 不存在：${missing.map((m) => m.id).join(', ')}`,
        400,
      )
    }

    // 单次 batch 原子写所有 sort_order
    const now = nowSql()
    const stmts = cleaned.map((x) =>
      db
        .prepare(
          `UPDATE tool_models SET sort_order = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(x.sortOrder, now, x.id),
    )
    await db.batch(stmts)

    return json({ updated: cleaned.length })
  } catch (error) {
    console.error('admin/tool-models/batch-reorder error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}