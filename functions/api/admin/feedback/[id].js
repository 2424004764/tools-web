// Admin 用户反馈单条
// PUT    /api/admin/feedback/:id  body: { status?, admin_note? }
// DELETE /api/admin/feedback/:id
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_STATUS = new Set(['pending', 'resolved', 'closed'])

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

function sanitizeText(value, max) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  const id = context.params?.id
  if (!id) return jsonError('缺少 id', 400)

  const existing = await db
    .prepare(`SELECT id FROM feedback WHERE id = ?`)
    .bind(id)
    .first()
  if (!existing) return jsonError('反馈不存在', 404)

  try {
    if (request.method === 'DELETE') {
      await db.prepare(`DELETE FROM feedback WHERE id = ?`).bind(id).run()
      return json({ id, deleted: true })
    }

    if (request.method !== 'PUT') return jsonError('不支持的请求方法', 405)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

    const sets = ["updated_at = datetime('now')"]
    const args = []

    if (body.status !== undefined) {
      const status = String(body.status || '').trim()
      if (!VALID_STATUS.has(status)) return jsonError('status 必须是 pending/resolved/closed', 400)
      sets.push('status = ?')
      args.push(status)
      sets.push('reviewed_by = ?')
      args.push(context.data?.adminUid || null)
      sets.push("reviewed_at = datetime('now')")
    }
    if (body.admin_note !== undefined) {
      sets.push('admin_note = ?')
      args.push(sanitizeText(body.admin_note, 500))
    }

    if (sets.length === 1) return jsonError('没有可更新的字段', 400)

    args.push(id)
    await db
      .prepare(`UPDATE feedback SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...args)
      .run()

    const row = await db
      .prepare(
        `SELECT id, uid, email, username, type, content, contact, page_url,
                user_agent, submit_ip, status, admin_note, reviewed_by, reviewed_at,
                created_at, updated_at
         FROM feedback WHERE id = ?`,
      )
      .bind(id)
      .first()
    return json(row)
  } catch (error) {
    console.error('admin feedback item error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
