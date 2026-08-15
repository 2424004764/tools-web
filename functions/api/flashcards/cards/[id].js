// 单卡片 API
// GET    /api/flashcards/cards/:id   获取卡片详情
// PUT    /api/flashcards/cards/:id   body: { front?, back?, is_suspended? }
// DELETE /api/flashcards/cards/:id   删除卡片（级联删除复习记录）

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
      .prepare('SELECT * FROM flashcards WHERE id = ? AND uid = ?')
      .bind(id, uid)
      .first()
    if (!card) return json({ success: false, error: '卡片不存在' }, 404)

    if (request.method === 'GET') {
      return json({ success: true, data: card })
    }

    if (request.method === 'PUT') {
      const body = await request.json().catch(() => ({}))
      const updates = []
      const values = []
      if (typeof body.front === 'string') {
        const front = body.front.trim()
        if (!front) return json({ success: false, error: '正面不能为空' }, 400)
        if (front.length > 5000) return json({ success: false, error: '正面不能超过 5000 字符' }, 400)
        updates.push('front = ?'); values.push(front)
      }
      if (typeof body.back === 'string') {
        const back = body.back.trim()
        if (!back) return json({ success: false, error: '背面不能为空' }, 400)
        if (back.length > 5000) return json({ success: false, error: '背面不能超过 5000 字符' }, 400)
        updates.push('back = ?'); values.push(back)
      }
      if (body.is_suspended !== undefined) {
        const v = body.is_suspended ? 1 : 0
        updates.push('is_suspended = ?'); values.push(v)
      }
      if (updates.length === 0) return json({ success: false, error: '没有可更新的字段' }, 400)
      updates.push('updated_at = ?'); values.push(nowMs())
      values.push(id); values.push(uid)
      await db
        .prepare(`UPDATE flashcards SET ${updates.join(', ')} WHERE id = ? AND uid = ?`)
        .bind(...values)
        .run()
      return json({ success: true })
    }

    if (request.method === 'DELETE') {
      await db
        .prepare('DELETE FROM flashcards WHERE id = ? AND uid = ?')
        .bind(id, uid)
        .run()
      return json({ success: true })
    }

    return json({ success: false, error: '不支持的请求方法' }, 405)
  } catch (err) {
    console.error('[flashcards/cards/:id] 错误:', err)
    return json({ success: false, error: err?.message || '服务器错误' }, 500)
  }
}