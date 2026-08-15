// 卡组 API
// GET  /api/flashcards/decks       列出当前用户的所有卡组（含每组卡片数与今日到期数）
// POST /api/flashcards/decks       body: { name, description?, daily_new_limit? }
//
// 鉴权：复用 model-resolver.js 的 extractUidFromRequest
// 数据隔离：WHERE uid = ?

import { extractUidFromRequest } from '../_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function nowMs() {
  return Date.now()
}

function validateDeckInput(body) {
  const errors = []
  const name = (body?.name ?? '').toString().trim()
  const description = (body?.description ?? '').toString().trim()
  let daily_new_limit = Number(body?.daily_new_limit ?? 20)
  if (!Number.isFinite(daily_new_limit)) daily_new_limit = 20
  if (daily_new_limit < 0) daily_new_limit = 0
  if (daily_new_limit > 999) daily_new_limit = 999
  if (!name) errors.push('卡组名不能为空')
  else if (name.length > 60) errors.push('卡组名不能超过 60 字符')
  if (description.length > 500) errors.push('描述不能超过 500 字符')
  return { errors, name, description, daily_new_limit }
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env?.DB
  if (!db) return json({ success: false, error: '数据库未配置' }, 500)

  const uid = await extractUidFromRequest(request, env).catch(() => '')
  if (!uid) return json({ success: false, error: '请先登录' }, 401)

  try {
    // ============ GET: 列出当前用户的全部卡组 ============
    if (request.method === 'GET') {
      // 用一个 LEFT JOIN 一次拿到 卡组 + 卡片总数 + 今日到期数
      const now = nowMs()
      const rows = await db
        .prepare(
          `SELECT
             d.id, d.name, d.description, d.daily_new_limit,
             d.created_at, d.updated_at,
             COUNT(c.id) AS total_cards,
             SUM(CASE WHEN c.is_suspended = 0 AND c.due_at <= ? THEN 1 ELSE 0 END) AS due_today,
             SUM(CASE WHEN c.is_suspended = 0 AND c.repetitions = 0 AND c.due_at <= ? THEN 1 ELSE 0 END) AS new_cards
           FROM flashcard_decks d
           LEFT JOIN flashcards c ON c.deck_id = d.id
           WHERE d.uid = ?
           GROUP BY d.id
           ORDER BY d.updated_at DESC`,
        )
        .bind(now, now, uid)
        .all()

      const data = (rows.results || []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        daily_new_limit: r.daily_new_limit,
        total_cards: r.total_cards || 0,
        due_today: r.due_today || 0,
        new_cards: r.new_cards || 0,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }))
      return json({ success: true, data })
    }

    // ============ POST: 新建卡组 ============
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { errors, name, description, daily_new_limit } = validateDeckInput(body)
      if (errors.length) return json({ success: false, error: errors.join('；') }, 400)

      const id = crypto.randomUUID()
      const now = nowMs()
      await db
        .prepare(
          `INSERT INTO flashcard_decks
             (id, uid, name, description, daily_new_limit, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, uid, name, description, daily_new_limit, now, now)
        .run()

      return json({
        success: true,
        data: {
          id,
          name,
          description,
          daily_new_limit,
          total_cards: 0,
          due_today: 0,
          new_cards: 0,
          created_at: now,
          updated_at: now,
        },
      })
    }

    return json({ success: false, error: '不支持的请求方法' }, 405)
  } catch (err) {
    console.error('[flashcards/decks] 错误:', err)
    return json({ success: false, error: err?.message || '服务器错误' }, 500)
  }
}