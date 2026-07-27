// 当前用户生成历史 API（前台消费）
// GET /api/me/generation-records?page=1&pageSize=10&status=...
// 返回 { ok, list: [...], pagination: {...} }
//
// 鉴权：复用 extractUidFromRequest；uid 从 JWT 推导，前端不可指定。
//   - 未登录 → 401
//   - 强制 WHERE r.uid = ? 隔离，只能看自己
// 字段比 admin 版少（不含 tx_id / idempotency_key / IP / user_agent），前台不暴露。
//
// 部署：已在 functions/_routes.json 注册。

import { extractUidFromRequest } from '../_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_STATUS = ['in_progress', 'success', 'failed', 'timeout', 'reversed']

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

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return jsonError('请先登录', 401)

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 10))
  const status = (url.searchParams.get('status') || '').trim()
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const offset = (page - 1) * pageSize

  try {
    const where = ['r.uid = ?']
    const args = [uid]
    if (status && VALID_STATUS.includes(status)) {
      where.push('r.status = ?')
      args.push(status)
    }
    if (keyword) {
      // 搜索 prompt / model / error_message（前端最关心的字段）
      where.push(
        '(r.model LIKE ? OR r.error_message LIKE ? OR json_extract(r.raw_data, \'$.prompt\') LIKE ?)',
      )
      const like = `%${keyword}%`
      args.push(like, like, like)
    }
    const whereSql = `WHERE ${where.join(' AND ')}`

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM generation_records r ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT r.id, r.source, r.mode, r.model, r.status, r.cost,
                r.result_url, r.error_message, r.duration_ms, r.upstream_duration_ms,
                r.upstream_status, r.raw_data, r.created_at
         FROM generation_records r
         ${whereSql}
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const totalPages = Math.ceil(total / pageSize)

    const items = (list.results || []).map((row) => ({
      ...row,
      raw_data_parsed: safeParse(row.raw_data),
    }))

    return json({
      ok: true,
      list: items,
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
    console.error('/api/me/generation-records error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}