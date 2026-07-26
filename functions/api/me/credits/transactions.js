// 当前用户积分流水 API（前台消费）
// GET /api/me/credits/transactions?page=1&pageSize=20
// 返回 { ok, list: [...], pagination: {...} }
//
// 鉴权：复用 extractUidFromRequest；uid 从 JWT 推导，前端不可指定。
//   - 未登录 → 401
//   - 只能看自己（无越权风险）
// 不含 operator 邮箱等敏感信息（前台不暴露）。
//
// 部署：同其它 me/* 路径，已在 _routes.json 注册。

import { extractUidFromRequest } from '../../_lib/model-resolver.js'

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

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return jsonError('请先登录', 401)

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const offset = (page - 1) * pageSize

  try {
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM credit_transactions WHERE uid = ?`)
      .bind(uid)
      .first()
    const total = totalRow?.c || 0

    // LEFT JOIN tool_features：reason 前缀是 tool url 的 slug（去掉首尾斜杠）
    // 例如 reason='ai-image-edit' → 拼成 '/ai-image-edit/' 去匹配 tool_features.url
    // 对系统赠送/管理员手工等没有工具前缀的流水，tool_title 为 null
    const list = await db
      .prepare(
        `SELECT t.id, t.type, t.amount, t.balance_after, t.reason, t.source, t.related_tx_id, t.created_at,
                CASE
                  WHEN instr(t.reason, ':') > 0
                  THEN '/' || substr(t.reason, 1, instr(t.reason, ':') - 1) || '/'
                  WHEN t.reason LIKE '%/%' THEN t.reason
                  WHEN length(t.reason) > 0 THEN '/' || t.reason || '/'
                  ELSE NULL
                END AS tool_url,
                f.title AS tool_title
         FROM credit_transactions t
         LEFT JOIN tool_features f
           ON f.url = CASE
             WHEN instr(t.reason, ':') > 0
             THEN '/' || substr(t.reason, 1, instr(t.reason, ':') - 1) || '/'
             WHEN t.reason LIKE '%/%' THEN t.reason
             WHEN length(t.reason) > 0 THEN '/' || t.reason || '/'
             ELSE NULL
           END
         WHERE t.uid = ?
         ORDER BY t.created_at DESC, t.id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(uid, pageSize, offset)
      .all()

    const totalPages = Math.ceil(total / pageSize)

    return json({
      ok: true,
      list: list.results || [],
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('/api/me/credits/transactions error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
