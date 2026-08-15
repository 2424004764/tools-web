// 卡组下的卡片 API
// GET  /api/flashcards/decks/:id/cards     列出该卡组所有卡片（按 due_at 升序）
// POST /api/flashcards/decks/:id/cards     body: { front, back, is_suspended? }
//
// 鉴权：先校验卡组归属当前用户，再允许读写其下卡片。
// 新卡 due_at = now（即立即可复习），repetitions=0, interval_days=0, ease_factor=2.5
// is_suspended 默认 0

import { extractUidFromRequest } from '../../../_lib/model-resolver.js'

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

function validateCardInput(body) {
  const errors = []
  const front = (body?.front ?? '').toString().trim()
  const back = (body?.back ?? '').toString().trim()
  if (!front) errors.push('正面内容不能为空')
  else if (front.length > 5000) errors.push('正面不能超过 5000 字符')
  if (!back) errors.push('背面内容不能为空')
  else if (back.length > 5000) errors.push('背面不能超过 5000 字符')
  const is_suspended = body?.is_suspended ? 1 : 0
  return { errors, front, back, is_suspended }
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env?.DB
  if (!db) return json({ success: false, error: '数据库未配置' }, 500)

  const uid = await extractUidFromRequest(request, env).catch(() => '')
  if (!uid) return json({ success: false, error: '请先登录' }, 401)

  const deckId = (context.params?.id || '').trim()
  if (!deckId) return json({ success: false, error: '缺少卡组 id' }, 400)

  try {
    const deck = await db
      .prepare('SELECT id FROM flashcard_decks WHERE id = ? AND uid = ?')
      .bind(deckId, uid)
      .first()
    if (!deck) return json({ success: false, error: '卡组不存在' }, 404)

    if (request.method === 'GET') {
      const url = new URL(request.url)
      const limit = Math.min(Number(url.searchParams.get('limit') || 1000), 5000)
      const rows = await db
        .prepare(
          `SELECT id, deck_id, front, back,
                  ease_factor, interval_days, repetitions, due_at, is_suspended,
                  created_at, updated_at
           FROM flashcards
           WHERE deck_id = ?
           ORDER BY is_suspended ASC, due_at ASC
           LIMIT ?`,
        )
        .bind(deckId, limit)
        .all()
      return json({ success: true, data: rows.results || [] })
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { errors, front, back, is_suspended } = validateCardInput(body)
      if (errors.length) return json({ success: false, error: errors.join('；') }, 400)

      const id = crypto.randomUUID()
      const now = nowMs()
      await db
        .prepare(
          `INSERT INTO flashcards
             (id, deck_id, uid, front, back,
              ease_factor, interval_days, repetitions, due_at, is_suspended,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?,
                   2.5, 0, 0, ?, ?,
                   ?, ?)`,
        )
        .bind(id, deckId, uid, front, back, now, is_suspended, now, now)
        .run()

      return json({
        success: true,
        data: {
          id,
          deck_id: deckId,
          front,
          back,
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          due_at: now,
          is_suspended,
          created_at: now,
          updated_at: now,
        },
      })
    }

    return json({ success: false, error: '不支持的请求方法' }, 405)
  } catch (err) {
    console.error('[flashcards/decks/:id/cards] 错误:', err)
    return json({ success: false, error: err?.message || '服务器错误' }, 500)
  }
}