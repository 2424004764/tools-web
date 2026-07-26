// 公开的工具 model 列表查询 API（前台消费）
// GET /api/tools/models?url=/ai-image-edit/
// 返回 { ok, url, models: [{ model_key, model_label, description, credit_cost, is_default }] }
//
// 鉴权：不要求登录；用于前端渲染下拉框 + 显示 cost。
// 仅返回 is_enabled = 1 的 model，按 sort_order 排序。
// 始终包含 is_default = 1 的项；若都没有则取 sort_order 最小的项作为默认。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const url = new URL(request.url)
  const toolUrl = url.searchParams.get('url') || ''
  if (!toolUrl) return jsonError('缺少 url 参数', 400)

  try {
    const result = await db
      .prepare(
        `SELECT model_key, model_label, description, credit_cost, is_default
         FROM tool_models
         WHERE tool_url = ? AND is_enabled = 1
         ORDER BY sort_order ASC, id ASC`,
      )
      .bind(toolUrl)
      .all()

    const models = (result.results || []).map((r) => ({
      model_key: r.model_key,
      model_label: r.model_label,
      description: r.description,
      credit_cost: r.credit_cost ?? 0,
      is_default: r.is_default === 1,
    }))

    return json({ ok: true, url: toolUrl, models })
  } catch (error) {
    console.error('public /api/tools/models error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
