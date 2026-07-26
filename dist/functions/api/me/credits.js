// 当前登录用户的积分余额查询（前台消费）
// GET /api/me/credits
// 返回 { ok, balance, total_earned, total_spent, updated_at }
//
// 鉴权：复用 extractUidFromRequest（model-resolver.js）
//   - 未登录 → 401
//   - 有积分行 → 返回真实余额
//   - 无积分行 → 全部返回 0（不返回 404），前端按 0 处理
//
// 部署：
//   wrangler pages deploy（含 dist 同步）；本文件已在 functions/_routes.json 注册

import { extractUidFromRequest } from '../_lib/model-resolver.js'

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

  try {
    const row = await db
      .prepare(
        `SELECT balance, total_earned, total_spent, updated_at
         FROM user_credits
         WHERE uid = ?`,
      )
      .bind(uid)
      .first()

    if (!row) {
      return json({
        ok: true,
        uid,
        balance: 0,
        total_earned: 0,
        total_spent: 0,
        updated_at: null,
      })
    }

    return json({
      ok: true,
      uid,
      balance: row.balance ?? 0,
      total_earned: row.total_earned ?? 0,
      total_spent: row.total_spent ?? 0,
      updated_at: row.updated_at ?? null,
    })
  } catch (error) {
    console.error('/api/me/credits error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
