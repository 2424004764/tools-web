// Admin 慢查询日志查询 API
// GET /api/admin/slow-query-logs?page=1&pageSize=20&table=&source=&path=&uid=&keyword=&minDuration=&startDate=&endDate=
//
// 鉴权已在 _middleware.js 完成。
// 注意：本文件直接走原始 db.prepare，不经 wrapDb（避免被自己的慢查询日志循环记录）。

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

const ALLOWED_SOURCES = new Set(['model', 'raw'])
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/

export async function onRequest(context) {
  const { request, env } = context
  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  if (request.method === 'DELETE') return cleanup(db, url_search(request))
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const params = url_search(request)
  const page = Math.max(1, parseInt(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize) || 20))
  const tableFilter = (params.table || '').trim()
  const sourceFilter = (params.source || '').trim()
  const pathFilter = (params.path || '').trim()
  const uidFilter = (params.uid || '').trim()
  const keyword = (params.keyword || '').trim()
  const minDurationRaw = parseInt(params.minDuration, 10)
  const minDuration = Number.isFinite(minDurationRaw) && minDurationRaw > 0 ? minDurationRaw : null
  const startDate = (params.startDate || '').trim()
  const endDate = (params.endDate || '').trim()
  const offset = (page - 1) * pageSize

  try {
    const where = []
    const args = []

    if (tableFilter) {
      where.push('table_name = ?')
      args.push(tableFilter)
    }
    if (sourceFilter && ALLOWED_SOURCES.has(sourceFilter)) {
      where.push('source = ?')
      args.push(sourceFilter)
    }
    if (pathFilter) {
      where.push('path LIKE ?')
      args.push(`%${pathFilter}%`)
    }
    if (uidFilter) {
      where.push('uid = ?')
      args.push(uidFilter)
    }
    if (keyword) {
      where.push('(sql_text LIKE ? OR error LIKE ? OR path LIKE ?)')
      const like = `%${keyword}%`
      args.push(like, like, like)
    }
    if (minDuration !== null) {
      where.push('duration_ms >= ?')
      args.push(minDuration)
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
      .prepare(`SELECT COUNT(*) AS c FROM slow_query_logs ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT id, sql_text, params, operation, table_name,
                duration_ms, path, method, uid, source, error, created_at
         FROM slow_query_logs
         ${whereSql}
         ORDER BY duration_ms DESC, created_at DESC
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
    console.error('admin slow-query-logs list error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}

// 简单封装：把 searchParams 一次性取出，避免在两个分支里重复 new URL
function url_search(request) {
  const url = new URL(request.url)
  return Object.fromEntries(url.searchParams.entries())
}

// DELETE /api/admin/slow-query-logs?days=N  清理 N 天前的记录（默认 30）
async function cleanup(db, params) {
  const days = Math.max(1, Math.min(365, parseInt(params.days) || 30))
  const cutoff = new Date(Date.now() - days * 86400 * 1000)
    .toISOString().slice(0, 19).replace('T', ' ')
  try {
    const result = await db
      .prepare(`DELETE FROM slow_query_logs WHERE created_at < ?`)
      .bind(cutoff)
      .run()
    return json({ deleted: result.meta?.changes || 0, cutoff, days })
  } catch (error) {
    console.error('admin slow-query-logs cleanup error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
