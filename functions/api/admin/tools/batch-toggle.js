// Admin 批量启停工具 API
// POST /api/admin/tools/batch-toggle
// body: { ids: ["1","2","3"], is_enabled: 0|1 }
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

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const body = await request.json().catch(() => ({}))
  const { ids, is_enabled } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return jsonError('ids 必须是非空数组', 400)
  }
  if (ids.length > 200) {
    return jsonError('单次最多 200 个工具', 400)
  }
  if (typeof is_enabled !== 'boolean' && is_enabled !== 0 && is_enabled !== 1) {
    return jsonError('is_enabled 必须是 0 或 1', 400)
  }

  const enabled = is_enabled === 1 || is_enabled === true ? 1 : 0
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  try {
    // SQLite 单条 IN 子句上限 999，200 个以内单条足够
    const placeholders = ids.map(() => '?').join(',')
    const result = await db
      .prepare(
        `UPDATE tool_features
         SET is_enabled = ?, updated_at = ?
         WHERE id IN (${placeholders})`,
      )
      .bind(enabled, now, ...ids)
      .run()

    const changes = result.meta?.changes ?? result.changes ?? 0
    return json({ updated: changes, is_enabled: enabled })
  } catch (error) {
    console.error('admin/tools/batch-toggle error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}