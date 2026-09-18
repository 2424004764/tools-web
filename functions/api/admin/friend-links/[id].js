// Admin 友情链接单条
// PUT    /api/admin/friend-links/:id  body: { status?, reject_reason?, sort_order?, name?, description? }
// DELETE /api/admin/friend-links/:id
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
    .prepare(`SELECT id, status FROM friend_links WHERE id = ?`)
    .bind(id)
    .first()
  if (!existing) return jsonError('友链不存在', 404)

  try {
    if (request.method === 'DELETE') {
      await db.prepare(`DELETE FROM friend_links WHERE id = ?`).bind(id).run()
      return json({ id, deleted: true })
    }

    if (request.method !== 'PUT') return jsonError('不支持的请求方法', 405)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

    const sets = ['updated_at = datetime(\'now\')']
    const args = []

    if (body.name !== undefined) {
      const name = sanitizeText(body.name, 40)
      if (!name) return jsonError('网站名称不能为空', 400)
      sets.push('name = ?')
      args.push(name)
    }
    if (body.description !== undefined) {
      sets.push('description = ?')
      args.push(sanitizeText(body.description, 80))
    }
    if (body.sort_order !== undefined) {
      const n = parseInt(body.sort_order, 10)
      if (Number.isNaN(n) || n < 0 || n > 9999) return jsonError('排序需为 0~9999 的整数', 400)
      sets.push('sort_order = ?')
      args.push(n)
    }
    if (body.status !== undefined) {
      const status = String(body.status || '').trim()
      if (!VALID_STATUS.has(status)) return jsonError('status 必须是 pending/approved/rejected', 400)
      sets.push('status = ?')
      args.push(status)
      sets.push('reviewed_by = ?')
      args.push(context.data?.adminUid || null)
      sets.push('reviewed_at = datetime(\'now\')')
      if (status === 'rejected') {
        sets.push('reject_reason = ?')
        args.push(sanitizeText(body.reject_reason, 200) || null)
      } else {
        sets.push('reject_reason = NULL')
      }
    } else if (body.reject_reason !== undefined) {
      sets.push('reject_reason = ?')
      args.push(sanitizeText(body.reject_reason, 200) || null)
    }

    if (sets.length === 1) return jsonError('没有可更新的字段', 400)

    args.push(id)
    await db
      .prepare(`UPDATE friend_links SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...args)
      .run()

    const row = await db
      .prepare(
        `SELECT id, name, url, description, contact, status, sort_order,
                submit_ip, reject_reason, reviewed_by, reviewed_at, created_at, updated_at
         FROM friend_links WHERE id = ?`,
      )
      .bind(id)
      .first()
    return json(row)
  } catch (error) {
    console.error('admin friend-links item error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
