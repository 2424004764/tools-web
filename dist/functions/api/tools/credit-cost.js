// 公开的工具价目查询 API（前台消费）
// GET /api/tools/credit-cost?url=/ai-image-edit/
// 返回 { cost, requiresLogin, ok: true }
//
// 鉴权：不要求登录；用于前端在按钮上展示"提交（X 积分）"。
// 若 url 未在 tool_features 表里登记，按 0 处理（向后兼容）。
// 若工具被禁用（is_enabled = 0），也按 0 处理（用户看不到的就不该计费）。

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
    const row = await db
      .prepare(
        `SELECT credit_cost, is_enabled FROM tool_features WHERE url = ? LIMIT 1`,
      )
      .bind(toolUrl)
      .first()

    // 未登记或已禁用 → 视为免费（cost = 0）
    const cost = row && row.is_enabled === 1 ? (row.credit_cost ?? 0) : 0

    return json({
      ok: true,
      url: toolUrl,
      cost,
      requiresLogin: cost > 0,
    })
  } catch (error) {
    console.error('public /api/tools/credit-cost error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
