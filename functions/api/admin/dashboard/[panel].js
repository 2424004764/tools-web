// Admin 仪表盘单面板 API
// GET /api/admin/dashboard/:panel
// panel ∈ overview | userTrend | usage | topTools | slowlog | pending | transactions
//
// 供前端各卡片独立拉取数据：单个面板慢/失败不影响其他面板渲染。
// 聚合接口 GET /api/admin/dashboard 仍保留，兼容旧调用。
//
// 鉴权已在 _middleware.js 完成。

import { PANEL_QUERIES } from './_data.js'

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

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const panel = String(params?.panel || '')
  const query = PANEL_QUERIES[panel]
  if (!query) {
    return jsonError(
      `未知面板：${panel}（可选：${Object.keys(PANEL_QUERIES).join(', ')}）`,
      404,
    )
  }

  // 趋势窗口参数（usage / userTrend）：不传走默认；上限防滥用
  const url = new URL(request.url)
  const numParam = (name, def, max) => {
    const n = parseInt(url.searchParams.get(name), 10)
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def
  }
  const opts = {
    dailyDays: numParam('dailyDays', 90, 365),
    weeklyWeeks: numParam('weeklyWeeks', 12, 52),
    monthlyMonths: numParam('monthlyMonths', 12, 24),
  }

  const db = env.DB
  try {
    return json(await query(db, opts))
  } catch (error) {
    console.error(`dashboard [${panel}] API error:`, error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
