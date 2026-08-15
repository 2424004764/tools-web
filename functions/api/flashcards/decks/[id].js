// 单卡组 API
// GET    /api/flashcards/decks/:id   获取卡组详情（含卡片总数、今日到期数）
// PUT    /api/flashcards/decks/:id   body: { name?, description?, daily_new_limit? }
// DELETE /api/flashcards/decks/:id   删除卡组（级联删除卡片与复习记录）

import { extractUidFromRequest } from '../../_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
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

async function loadOwnedDeck(db, id, uid) {
  return await db
    .prepare('SELECT * FROM flashcard_decks WHERE id = ? AND uid = ?')
    .bind(id, uid)
    .first()
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env?.DB
  if (!db) return json({ success: false, error: '数据库未配置' }, 500)

  const uid = await extractUidFromRequest(request, env).catch(() => '')
  if (!uid) return json({ success: false, error: '请先登录' }, 401)

  const id = (context.params?.id || '').trim()
  if (!id) return json({ success: false, error: '缺少卡组 id' }, 400)

  try {
    const deck = await loadOwnedDeck(db, id, uid)
    if (!deck) return json({ success: false, error: '卡组不存在' }, 404)

    if (request.method === 'GET') {
      const now = nowMs()
      const agg = await db
        .prepare(
          `SELECT
             COUNT(*) AS total_cards,
             SUM(CASE WHEN is_suspended = 0 AND due_at <= ? THEN 1 ELSE 0 END) AS due_today,
             SUM(CASE WHEN is_suspended = 0 AND repetitions = 0 AND due_at <= ? THEN 1 ELSE 0 END) AS new_cards
           FROM flashcards
           WHERE deck_id = ?`,
        )
        .bind(now, now, id)
        .first()
      return json({
        success: true,
        data: {
          id: deck.id,
          name: deck.name,
          description: deck.description || '',
          daily_new_limit: deck.daily_new_limit,
          created_at: deck.created_at,
          updated_at: deck.updated_at,
          total_cards: agg?.total_cards || 0,
          due_today: agg?.due_today || 0,
          new_cards: agg?.new_cards || 0,
        },
      })
    }

    if (request.method === 'PUT') {
      const body = await request.json().catch(() => ({}))
      const updates = []
      const values = []
      if (typeof body.name === 'string') {
        const name = body.name.trim()
        if (!name) return json({ success: false, error: '卡组名不能为空' }, 400)
        if (name.length > 60) return json({ success: false, error: '卡组名不能超过 60 字符' }, 400)
        updates.push('name = ?'); values.push(name)
      }
      if (typeof body.description === 'string') {
        const description = body.description.trim()
        if (description.length > 500) return json({ success: false, error: '描述不能超过 500 字符' }, 400)
        updates.push('description = ?'); values.push(description)
      }
      if (body.daily_new_limit !== undefined) {
        let v = Number(body.daily_new_limit)
        if (!Number.isFinite(v)) v = 20
        if (v < 0) v = 0
        if (v > 999) v = 999
        updates.push('daily_new_limit = ?'); values.push(v)
      }
      if (updates.length === 0) return json({ success: false, error: '没有可更新的字段' }, 400)
      updates.push('updated_at = ?'); values.push(nowMs())
      values.push(id); values.push(uid)
      await db
        .prepare(`UPDATE flashcard_decks SET ${updates.join(', ')} WHERE id = ? AND uid = ?`)
        .bind(...values)
        .run()
      return json({ success: true })
    }

    if (request.method === 'DELETE') {
      // 依赖 ON DELETE CASCADE 自动清理 flashcards / flashcard_reviews
      await db
        .prepare('DELETE FROM flashcard_decks WHERE id = ? AND uid = ?')
        .bind(id, uid)
        .run()
      return json({ success: true })
    }

    return json({ success: false, error: '不支持的请求方法' }, 405)
  } catch (err) {
    console.error('[flashcards/decks/:id] 错误:', err)
    return json({ success: false, error: err?.message || '服务器错误' }, 500)
  }
}