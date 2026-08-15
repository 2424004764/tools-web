// 拉取今日复习队列
// GET /api/flashcards/due?deck_id=xxx[&limit=200]
//
// 排序逻辑：
//   1. 优先到期（due_at <= now 且 is_suspended = 0 且 repetitions > 0）
//   2. 然后是新卡（repetitions = 0 且 is_suspended = 0）且数量受 deck.daily_new_limit 限制
//   3. 每张卡按 due_at 升序，先到期先复习
//
// 响应：
//   data: { queue: [...], total: n, deck: {...} }

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

function nowMs() {
  return Date.now()
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env?.DB
  if (!db) return json({ success: false, error: '数据库未配置' }, 500)

  const uid = await extractUidFromRequest(request, env).catch(() => '')
  if (!uid) return json({ success: false, error: '请先登录' }, 401)

  const url = new URL(request.url)
  const deckId = (url.searchParams.get('deck_id') || '').trim()
  if (!deckId) return json({ success: false, error: '缺少 deck_id 参数' }, 400)

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 200), 1), 500)

  try {
    const deck = await db
      .prepare('SELECT id, name, daily_new_limit FROM flashcard_decks WHERE id = ? AND uid = ?')
      .bind(deckId, uid)
      .first()
    if (!deck) return json({ success: false, error: '卡组不存在' }, 404)

    const now = nowMs()
    // 1) 复习卡：已学过的卡片到期需要复习
    const reviewRows = await db
      .prepare(
        `SELECT id, deck_id, front, back, ease_factor, interval_days, repetitions, due_at,
                is_suspended, created_at, updated_at
         FROM flashcards
         WHERE deck_id = ?
           AND uid = ?
           AND is_suspended = 0
           AND repetitions > 0
           AND due_at <= ?
         ORDER BY due_at ASC
         LIMIT ?`,
      )
      .bind(deckId, uid, now, limit)
      .all()

    // 2) 新卡：尚未学过，每日有上限
    const dailyNewLimit = Number(deck.daily_new_limit ?? 20)
    let newRows = { results: [] }
    if (dailyNewLimit > 0) {
      newRows = await db
        .prepare(
          `SELECT id, deck_id, front, back, ease_factor, interval_days, repetitions, due_at,
                  is_suspended, created_at, updated_at
           FROM flashcards
           WHERE deck_id = ?
             AND uid = ?
             AND is_suspended = 0
             AND repetitions = 0
           ORDER BY created_at ASC
           LIMIT ?`,
        )
        .bind(deckId, uid, dailyNewLimit)
        .all()
    }

    const reviewList = reviewRows.results || []
    const newList = newRows.results || []
    // 复习在前，新卡在后；总长度仍受 limit 控制
    let queue = [...reviewList, ...newList]
    if (queue.length > limit) queue = queue.slice(0, limit)

    return json({
      success: true,
      data: {
        queue,
        total: queue.length,
        review_count: reviewList.length,
        new_count: newList.length,
        daily_new_limit: dailyNewLimit,
        deck: { id: deck.id, name: deck.name },
      },
    })
  } catch (err) {
    console.error('[flashcards/due] 错误:', err)
    return json({ success: false, error: err?.message || '服务器错误' }, 500)
  }
}