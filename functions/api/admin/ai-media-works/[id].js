// Admin AI 媒体作品单条 API
// 鉴权：functions/api/admin/_middleware.js
// 路由：
//   PUT    /api/admin/ai-media-works/:id  body: { audit_status }  审核（approved/pending/rejected）
//   DELETE /api/admin/ai-media-works/:id                          删除

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_AUDIT = new Set(['approved', 'pending', 'rejected'])

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

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env.DB
  const url = new URL(request.url)
  const segs = url.pathname.split('/').filter(Boolean)
  // 期望 ['api', 'admin', 'ai-media-works', ':id']
  const idStr = segs[3]
  const id = parseInt(idStr, 10)
  if (!Number.isFinite(id) || id <= 0) return jsonError('无效的 id', 400)

  try {
    const existing = await db
      .prepare(`SELECT id, audit_status FROM ai_media_works WHERE id = ?`)
      .bind(id)
      .first()
    if (!existing) return jsonError('作品不存在', 404)

    // PUT：审核
    if (request.method === 'PUT') {
      const body = await request.json().catch(() => null)
      if (!body) return jsonError('请求体需为 JSON', 400)
      const audit = String(body.audit_status || '').trim().toLowerCase()
      if (!VALID_AUDIT.has(audit)) {
        return jsonError('audit_status 必须是 approved/pending/rejected', 400)
      }
      await db
        .prepare(
          `UPDATE ai_media_works SET audit_status = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(audit, nowSql(), id)
        .run()
      console.log(`[admin/ai-media-works] audit id=${id} -> ${audit} by adminUid=${context.data?.adminUid || '?'}`)
      return json({ id, audit_status: audit })
    }

    // DELETE：删除
    if (request.method === 'DELETE') {
      await db.prepare(`DELETE FROM ai_media_works WHERE id = ?`).bind(id).run()
      console.log(`[admin/ai-media-works] DELETE id=${id} by adminUid=${context.data?.adminUid || '?'}`)
      return json({ id, deleted: true })
    }

    // GET：单条详情（管理员可见全部状态）
    if (request.method === 'GET') {
      const row = await db
        .prepare(
          `SELECT id, media_type, media_url, thumbnail_url, prompt, category,
                  model_name, source_name, source_url,
                  width, height, duration, file_size, tags,
                  audit_status, view_count, created_at, updated_at
           FROM ai_media_works WHERE id = ?`,
        )
        .bind(id)
        .first()
      if (!row) return jsonError('作品不存在', 404)
      return json(row)
    }

    return jsonError('不支持的请求方法', 405)
  } catch (error) {
    console.error('admin ai-media-works [id] error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
