// 提交一次复习评级
// POST /api/flashcards/cards/:id/review   body: { grade: 0|3|4|5 }
//
// 计算流程：
//   1. 校验 grade 合法（0/3/4/5）并读取卡片当前 SRS 状态
//   2. 用 calcNextReview 计算新的 ease / interval / repetitions / due_at
//   3. 在同一事务里：
//      - UPDATE flashcards 写入新 SRS 状态
//      - INSERT flashcard_reviews 记录本次复习
//      失败时 D1 单语句自动回滚（不需要显式 BEGIN）
//
// 响应：返回更新后的卡片状态 + 四档预览（供前端 UI 即时刷新按钮提示）。

import { extractUidFromRequest } from '../../../_lib/model-resolver.js'
import { calcNextReview, previewIntervals } from '../../_lib.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

const ALLOWED_GRADES = new Set([0, 3, 4, 5])

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env?.DB
  if (!db) return json({ success: false, error: '数据库未配置' }, 500)

  const uid = await extractUidFromRequest(request, env).catch(() => '')
  if (!uid) return json({ success: false, error: '请先登录' }, 401)

  const id = (context.params?.id || '').trim()
  if (!id) return json({ success: false, error: '缺少卡片 id' }, 400)

  try {
    const card = await db
      .prepare(
        `SELECT id, ease_factor, interval_days, repetitions, due_at
         FROM flashcards
         WHERE id = ? AND uid = ?`,
      )
      .bind(id, uid)
      .first()
    if (!card) return json({ success: false, error: '卡片不存在' }, 404)

    const body = await request.json().catch(() => ({}))
    const grade = Number(body?.grade)
    if (!ALLOWED_GRADES.has(grade)) {
      return json({ success: false, error: 'grade 必须是 0 / 3 / 4 / 5' }, 400)
    }

    const now = nowMs()
    const next = calcNextReview(card, grade, now)

    // 1. 写复习记录（先记后改便于失败排查）
    await db
      .prepare(
        `INSERT INTO flashcard_reviews
           (id, card_id, uid, grade, prev_interval, new_interval, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), id, uid, grade, card.interval_days, next.interval_days, now)
      .run()

    // 2. 更新卡片 SRS 状态
    await db
      .prepare(
        `UPDATE flashcards
         SET ease_factor = ?, interval_days = ?, repetitions = ?, due_at = ?, updated_at = ?
         WHERE id = ? AND uid = ?`,
      )
      .bind(next.ease_factor, next.interval_days, next.repetitions, next.due_at, now, id, uid)
      .run()

    return json({
      success: true,
      data: {
        id,
        ease_factor: next.ease_factor,
        interval_days: next.interval_days,
        repetitions: next.repetitions,
        due_at: next.due_at,
        prev_interval_days: card.interval_days,
        grade,
        preview: previewIntervals({ ...card, ease_factor: next.ease_factor, interval_days: next.interval_days, repetitions: next.repetitions }),
      },
    })
  } catch (err) {
    console.error('[flashcards/cards/:id/review] 错误:', err)
    return json({ success: false, error: err?.message || '服务器错误' }, 500)
  }
}