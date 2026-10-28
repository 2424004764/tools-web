// Admin 批量删除反馈
// POST /api/admin/feedback/batch-delete body: { ids: string[] }
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

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

const BATCH_LIMIT = 200

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)
  if (!env.DB) return jsonError('数据库未配置', 500)

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return jsonError('ids 必须是非空数组，请先勾选反馈', 400)
  }

  const ids = [...new Set(body.ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
  if (ids.length === 0) return jsonError('ids 中没有合法的反馈 id', 400)
  if (ids.length > BATCH_LIMIT) return jsonError(`单次最多删除 ${BATCH_LIMIT} 条反馈`, 400)

  try {
    const statements = ids.map((id) => env.DB.prepare('DELETE FROM feedback WHERE id = ?').bind(id))
    const results = await env.DB.batch(statements)
    const deleted = results.reduce((sum, result) => sum + (result.meta?.changes || 0), 0)
    const failed = results.flatMap((result, index) =>
      result.success === false ? [{ id: ids[index], error: '删除失败' }] : [],
    )
    return json({ requested: ids.length, deleted, failed })
  } catch (error) {
    console.error('admin feedback batch-delete error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
