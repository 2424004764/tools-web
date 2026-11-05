// Admin 批量审核文章
// POST /api/admin/blog/posts/batch-review body: { ids: string[], status: 'published' | 'rejected' }
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const BATCH_LIMIT = 200

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
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)
  if (!env.DB) return jsonError('数据库未配置', 500)

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return jsonError('ids 必须是非空数组，请先勾选文章', 400)
  }

  const ids = [...new Set(body.ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
  if (ids.length === 0) return jsonError('ids 中没有合法的文章 id', 400)
  if (ids.length > BATCH_LIMIT) return jsonError(`单次最多审核 ${BATCH_LIMIT} 篇文章`, 400)

  const status = body.status
  if (status !== 'published' && status !== 'rejected') {
    return jsonError('status 必须是 published 或 rejected', 400)
  }
  const rejectReason = status === 'rejected' ? sanitizeText(body.reject_reason, 200) : ''
  if (status === 'rejected' && !rejectReason) return jsonError('驳回理由不能为空', 400)

  try {
    const statements = ids.map((id) => {
      const fields = [
        'status = ?',
        'reviewed_by = ?',
        `reviewed_at = datetime('now')`,
        'reject_reason = ?',
        `updated_at = datetime('now')`,
      ]
      const args = [status, context.data?.adminUid || null, rejectReason]
      if (status === 'published') fields.push(`published_at = COALESCE(published_at, datetime('now'))`)
      return env.DB.prepare(
        `UPDATE blog_posts SET ${fields.join(', ')} WHERE id = ? AND status = 'pending'`,
      ).bind(...args, id)
    })
    const results = await env.DB.batch(statements)
    const updated = results.reduce((sum, result) => sum + (result.meta?.changes || 0), 0)
    const failed = results.flatMap((result, index) =>
      result.success === false ? [{ id: ids[index], error: '审核失败' }] : [],
    )
    return json({ requested: ids.length, updated, skipped: ids.length - updated - failed.length, failed })
  } catch (error) {
    console.error('admin blog batch-review error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
