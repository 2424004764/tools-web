// Admin 评论单条
// PUT    /api/admin/comments/:id  body: { status: 'approved' | 'rejected' | 'pending' }
// DELETE /api/admin/comments/:id
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_STATUS = new Set(['pending', 'approved', 'rejected'])

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  const id = context.params?.id
  if (!id) return jsonError('缺少 id', 400)

  try {
    const existing = await db
      .prepare(`SELECT id, status FROM comments WHERE id = ?`)
      .bind(id)
      .first()
    if (!existing) return jsonError('评论不存在', 404)

    if (request.method === 'DELETE') {
      await db.prepare(`DELETE FROM comments WHERE id = ?`).bind(id).run()
      return json({ id, deleted: true })
    }

    if (request.method !== 'PUT') return jsonError('不支持的请求方法', 405)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

    const status = String(body.status || '').trim()
    if (!VALID_STATUS.has(status)) return jsonError('status 必须是 pending/approved/rejected', 400)

    await db
      .prepare(
        `UPDATE comments
         SET status = ?,
             reviewed_by = ?,
             reviewed_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(status, context.data?.adminUid || null, id)
      .run()

    const row = await db
      .prepare(
        `SELECT id, page_path, page_title, content, user_id, nickname, email, avatar,
                status, submit_ip, reviewed_by, reviewed_at, created_at
         FROM comments WHERE id = ?`,
      )
      .bind(id)
      .first()
    return json(row)
  } catch (error) {
    console.error('admin comments item error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
