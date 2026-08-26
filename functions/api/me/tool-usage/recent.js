// GET /api/me/tool-usage/recent?limit=N
//   鉴权：仅登录用户（未登录无 uid 概念，返回空数组）
//   返回：当前用户最近 N 个去重工具 [{ tool_url, tool_title, last_used_at, use_count }]
//   limit：默认 8，clamp 到 [1, 50]
//
// 路由说明：路径 /api/me/tool-usage/recent 精确匹配本文件，由 functions/_routes.json 注册。
//   这与 credits/transactions.js 是同一种拆分模式 —— wrangler 不允许在 _routes.json 列
//   通配路径却没有对应的 [[path]].js catch-all 文件，否则子路径会回退到 SPA fallback。

import { AuthMiddleware } from '../../../middlewares/auth.js'

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

export async function onRequestGet(context) {
  const { request, env } = context
  const db = env?.DB
  if (!db) return json({ items: [] })

  const auth = await AuthMiddleware.extractUserFromRequestOptional(request, env)
  if (!auth.success || !auth.user) return json({ items: [] })

  // 解析 limit：默认 8，clamp [1, 50]，非法值兜底 8
  const url = new URL(request.url)
  const raw = parseInt(url.searchParams.get('limit') || '', 10)
  const limit = Number.isFinite(raw) ? Math.min(50, Math.max(1, raw)) : 8

  try {
    const result = await db
      .prepare(
        `SELECT tool_url, tool_title,
                MAX(used_at) AS last_used_at,
                COUNT(*)    AS use_count
         FROM tool_usage_records
         WHERE uid = ?
         GROUP BY tool_url
         ORDER BY last_used_at DESC
         LIMIT ?`,
      )
      .bind(auth.user.id, limit)
      .all()
    return json({ items: result.results || [] })
  } catch (err) {
    console.warn('[tool-usage] recent query failed:', err?.message || err)
    return json({ items: [] })
  }
}

// 仅接受 GET，其他方法 405
export async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
  return onRequestGet(context)
}