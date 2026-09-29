// Admin 评论单条
// POST   /api/admin/comments/:id  body: { content }  站长回复；原评论待审时自动通过
// PUT    /api/admin/comments/:id  body: { status: 'approved' | 'rejected' | 'pending' }
// DELETE /api/admin/comments/:id
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_STATUS = new Set(['pending', 'approved', 'rejected'])
const MAX_REPLY_CONTENT = 1000

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

// 与公开评论接口一致：去标签 + 裁剪长度，保留换行
function sanitizeText(value, max) {
  let out = String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, max)
  const last = out.charCodeAt(out.length - 1)
  if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1)
  return out
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
      .prepare(
        `SELECT id, page_path, page_title, parent_id, status FROM comments WHERE id = ?`,
      )
      .bind(id)
      .first()
    if (!existing) return jsonError('评论不存在', 404)

    if (request.method === 'DELETE') {
      await db.prepare(`DELETE FROM comments WHERE id = ?`).bind(id).run()
      return json({ id, deleted: true })
    }

    // ---- POST：站长回复 ----
    // 回复行直接为 approved；原评论还在待审时顺带自动通过
    if (request.method === 'POST') {
      if (existing.parent_id) return jsonError('只能对用户评论回复，不能回复站长回复', 400)

      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

      const content = sanitizeText(body.content, MAX_REPLY_CONTENT)
      if (!content) return jsonError('回复内容不能为空', 400)

      // 回复人展示信息：取管理员对应的前台用户，缺失时回退「站长」
      let nickname = '站长'
      let avatar = ''
      const adminUser = await db
        .prepare(`SELECT username, avatar FROM user WHERE id = ?`)
        .bind(context.data?.adminUid || '')
        .first()
      if (adminUser?.username) nickname = sanitizeText(adminUser.username, 20) || nickname
      if (adminUser?.avatar) avatar = sanitizeText(adminUser.avatar, 500)

      const replyId = crypto.randomUUID()
      await db
        .prepare(
          `INSERT INTO comments (id, page_path, page_title, content, user_id, nickname, email, avatar,
                                 status, submit_ip, reviewed_by, reviewed_at, parent_id, is_admin)
           VALUES (?, ?, ?, ?, NULL, ?, '', ?, 'approved', '', ?, datetime('now'), ?, 1)`,
        )
        .bind(replyId, existing.page_path, existing.page_title || '', content,
              nickname, avatar, context.data?.adminUid || null, id)
        .run()

      let parentStatus = existing.status
      if (existing.status === 'pending') {
        await db
          .prepare(
            `UPDATE comments
             SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now')
             WHERE id = ?`,
          )
          .bind(context.data?.adminUid || null, id)
          .run()
        parentStatus = 'approved'
      }

      const reply = await db
        .prepare(
          `SELECT id, page_path, page_title, content, user_id, nickname, email, avatar,
                  status, submit_ip, reviewed_by, reviewed_at, parent_id, is_admin, created_at
           FROM comments WHERE id = ?`,
        )
        .bind(replyId)
        .first()
      return json({ reply, parent: { id, status: parentStatus } }, 201)
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
                status, submit_ip, reviewed_by, reviewed_at, parent_id, is_admin, created_at
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
