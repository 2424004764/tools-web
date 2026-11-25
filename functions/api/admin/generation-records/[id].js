// Admin 生成记录详情 API
// GET /api/admin/generation-records/:id
//
// 列表接口不返回 raw_data（体积过大），详情抽屉按需取单条。
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

function safeParse(str) {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const { id } = context.params
  if (!id) return jsonError('缺少记录 ID', 400)

  try {
    const row = await env.DB
      .prepare(
        `SELECT r.id, r.uid, r.source, r.mode, r.model, r.status, r.cost,
                r.result_url, r.error_message, r.duration_ms, r.upstream_duration_ms,
                r.upstream_status, r.idempotency_key, r.tx_id, r.raw_data, r.created_at,
                u.email AS user_email, u.username AS user_name
         FROM generation_records r
         LEFT JOIN user u ON u.id = r.uid
         WHERE r.id = ?`,
      )
      .bind(id)
      .first()

    if (!row) return jsonError('记录不存在', 404)

    // raw_data 是字符串，预解析方便前端直接用；解析失败回退为字符串
    return json({ ...row, raw_data_parsed: safeParse(row.raw_data) })
  } catch (error) {
    console.error('admin generation-records/[id] error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
