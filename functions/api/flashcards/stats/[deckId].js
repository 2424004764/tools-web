// 复习统计
// GET /api/flashcards/stats/:deckId
//
// 返回：
//   - total_cards: 卡组卡片总数
//   - suspended_cards: 已暂停的卡片数
//   - new_cards: repetitions=0 卡片数
//   - learning_cards: 1<=reps<=2 卡片数
//   - mature_cards: reps>=3 卡片数
//   - due_today: due_at <= now 卡片数
//   - reviews_today: 今日复习次数
//   - reviews_total: 累计复习次数
//   - streak_days: 连续复习天数（最近一次复习到今天的天数差）
//   - reviews_30d: 最近 30 天每日复习次数（数组）

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

function nowMs() {
  return Date.now()
}

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env?.DB
  if (!db) return json({ success: false, error: '数据库未配置' }, 500)

  const uid = await extractUidFromRequest(request, env).catch(() => '')
  if (!uid) return json({ success: false, error: '请先登录' }, 401)

  const deckId = (context.params?.deckId || '').trim()
  if (!deckId) return json({ success: false, error: '缺少 deckId' }, 400)

  try {
    const deck = await db
      .prepare('SELECT id, name FROM flashcard_decks WHERE id = ? AND uid = ?')
      .bind(deckId, uid)
      .first()
    if (!deck) return json({ success: false, error: '卡组不存在' }, 404)

    const now = nowMs()
    const todayStart = startOfDay(now)

    const cardStats = await db
      .prepare(
        `SELECT
           COUNT(*) AS total_cards,
           SUM(CASE WHEN is_suspended = 1 THEN 1 ELSE 0 END) AS suspended_cards,
           SUM(CASE WHEN is_suspended = 0 AND repetitions = 0 THEN 1 ELSE 0 END) AS new_cards,
           SUM(CASE WHEN is_suspended = 0 AND repetitions BETWEEN 1 AND 2 THEN 1 ELSE 0 END) AS learning_cards,
           SUM(CASE WHEN is_suspended = 0 AND repetitions >= 3 THEN 1 ELSE 0 END) AS mature_cards,
           SUM(CASE WHEN is_suspended = 0 AND due_at <= ? THEN 1 ELSE 0 END) AS due_today
         FROM flashcards WHERE deck_id = ?`,
      )
      .bind(now, deckId)
      .first()

    const reviewAgg = await db
      .prepare(
        `SELECT
           COUNT(*) AS reviews_total,
           SUM(CASE WHEN reviewed_at >= ? THEN 1 ELSE 0 END) AS reviews_today
         FROM flashcard_reviews r
         INNER JOIN flashcards c ON c.id = r.card_id
         WHERE c.deck_id = ?`,
      )
      .bind(todayStart, deckId)
      .first()

    // 最近 30 天每日复习次数（0 填充）
    const thirtyDaysAgo = todayStart - 29 * 24 * 60 * 60 * 1000
    const recent = await db
      .prepare(
        `SELECT reviewed_at
         FROM flashcard_reviews r
         INNER JOIN flashcards c ON c.id = r.card_id
         WHERE c.deck_id = ? AND reviewed_at >= ?`,
      )
      .bind(deckId, thirtyDaysAgo)
      .all()

    const dayMap = new Map()
    for (let i = 0; i < 30; i++) {
      const d = todayStart - i * 24 * 60 * 60 * 1000
      dayMap.set(d, 0)
    }
    for (const row of recent.results || []) {
      const dayKey = startOfDay(row.reviewed_at)
      if (dayMap.has(dayKey)) dayMap.set(dayKey, dayMap.get(dayKey) + 1)
    }
    const reviews_30d = Array.from(dayMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, count]) => ({ day, count }))

    // 连续天数：从今天往前，只要某天有复习就连续
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const dayKey = todayStart - i * 24 * 60 * 60 * 1000
      if ((dayMap.get(dayKey) || 0) > 0) streak++
      else if (i === 0) continue // 今天未复习不打断
      else break
    }

    return json({
      success: true,
      data: {
        deck: { id: deck.id, name: deck.name },
        total_cards: cardStats?.total_cards || 0,
        suspended_cards: cardStats?.suspended_cards || 0,
        new_cards: cardStats?.new_cards || 0,
        learning_cards: cardStats?.learning_cards || 0,
        mature_cards: cardStats?.mature_cards || 0,
        due_today: cardStats?.due_today || 0,
        reviews_today: reviewAgg?.reviews_today || 0,
        reviews_total: reviewAgg?.reviews_total || 0,
        streak_days: streak,
        reviews_30d,
      },
    })
  } catch (err) {
    console.error('[flashcards/stats/:deckId] 错误:', err)
    return json({ success: false, error: err?.message || '服务器错误' }, 500)
  }
}