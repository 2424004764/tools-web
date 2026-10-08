// Admin IP 解封
//   DELETE /api/admin/ip-bans/:id
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
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

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'DELETE') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const id = context.params?.id
  if (!id) return jsonError('缺少 id', 400)

  try {
    const existing = await db.prepare(`SELECT id FROM ip_bans WHERE id = ?`).bind(id).first()
    if (!existing) return jsonError('封禁规则不存在或已解除', 404)

    await db.prepare(`DELETE FROM ip_bans WHERE id = ?`).bind(id).run()
    return json({ id, deleted: true })
  } catch (err) {
    console.error('[admin/ip-bans] delete error:', err)
    return jsonError(err.message || '服务器错误', 500)
  }
}
