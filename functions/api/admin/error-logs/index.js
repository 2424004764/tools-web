// Admin 错误日志查询 API
// GET /api/admin/error-logs?page=1&pageSize=20&path=&status=&stage=&uid=&keyword=&startDate=&endDate=
//
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

const ALLOWED_STAGES = new Set([
  'validation', 'auth', 'db', 'kv', 'upstream', 'unknown',
])

// ISO 8601 简单校验，避免把无效字符串塞到 SQL 参数里
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/

export async function onRequest(context) {
  const { request, env } = context
  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  if (request.method === 'DELETE') return cleanup(context, db)
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const pathFilter = (url.searchParams.get('path') || '').trim()
  const statusFilter = url.searchParams.get('status')
  const stageFilter = url.searchParams.get('stage')
  const uidFilter = (url.searchParams.get('uid') || '').trim()
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const startDate = (url.searchParams.get('startDate') || '').trim()
  const endDate = (url.searchParams.get('endDate') || '').trim()
  const offset = (page - 1) * pageSize

  try {
    const where = []
    const args = []

    if (pathFilter) {
      where.push('path LIKE ?')
      args.push(`%${pathFilter}%`)
    }
    if (statusFilter) {
      const s = parseInt(statusFilter, 10)
      if (!Number.isNaN(s) && s >= 400 && s < 600) {
        where.push('status = ?')
        args.push(s)
      }
    }
    if (stageFilter && ALLOWED_STAGES.has(stageFilter)) {
      where.push('error_stage = ?')
      args.push(stageFilter)
    }
    if (uidFilter) {
      where.push('uid = ?')
      args.push(uidFilter)
    }
    if (keyword) {
      where.push('(error_message LIKE ? OR upstream_body LIKE ? OR path LIKE ?)')
      const like = `%${keyword}%`
      args.push(like, like, like)
    }
    if (startDate && ISO_DATE_RE.test(startDate)) {
      where.push('created_at >= ?')
      args.push(startDate)
    }
    if (endDate && ISO_DATE_RE.test(endDate)) {
      where.push('created_at <= ?')
      args.push(endDate)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM api_error_logs ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT id, path, method, status, error_message, error_stage,
                upstream_name, upstream_status, upstream_body,
                uid, client_ip, user_agent, duration_ms, extra, created_at
         FROM api_error_logs
         ${whereSql}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const totalPages = Math.ceil(total / pageSize)
    return json({
      list: list.results || [],
      pagination: {
        total, page, pageSize, totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('admin error-logs list error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}

// DELETE /api/admin/error-logs?days=N  清理 N 天前的记录（默认 30）
async function cleanup(context, db) {
  const { request } = context
  const url = new URL(request.url)
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days')) || 30))
  const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString()
  try {
    const result = await db
      .prepare(`DELETE FROM api_error_logs WHERE created_at < ?`)
      .bind(cutoff)
      .run()
    return json({ deleted: result.meta?.changes || 0, cutoff, days })
  } catch (error) {
    console.error('admin error-logs cleanup error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
