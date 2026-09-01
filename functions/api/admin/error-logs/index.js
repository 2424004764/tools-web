// Admin 错误日志查询 / 处理 API
// GET    /api/admin/error-logs?page=1&pageSize=20&path=&status=&stage=&uid=&keyword=&startDate=&endDate=&resolved=0|1
// PATCH  /api/admin/error-logs/{id}              body: { is_resolved: 0|1, resolved_note?: string }
// DELETE /api/admin/error-logs?days=N            清理 N 天前的记录（默认 30）
//
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
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

  const url = new URL(request.url)

  // PATCH /api/admin/error-logs/{id} —— 标记 / 取消标记
  if (request.method === 'PATCH') {
    const m = url.pathname.match(/^\/api\/admin\/error-logs\/([^/]+)$/)
    if (!m) return jsonError('路径格式错误', 404)
    return updateResolved(context, db, m[1])
  }

  if (request.method === 'DELETE') {
    // 仅根路径支持清理；/{id} 不允许 DELETE（避免误操作）
    if (url.pathname !== '/api/admin/error-logs') {
      return jsonError('该资源不支持 DELETE', 405)
    }
    return cleanup(context, db)
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const pathFilter = (url.searchParams.get('path') || '').trim()
  const statusFilter = url.searchParams.get('status')
  const stageFilter = url.searchParams.get('stage')
  const uidFilter = (url.searchParams.get('uid') || '').trim()
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const startDate = (url.searchParams.get('startDate') || '').trim()
  const endDate = (url.searchParams.get('endDate') || '').trim()
  // resolved 过滤：1=只看已处理，0=只看未处理；其他值（空串/null）=全部
  const resolvedFilter = url.searchParams.get('resolved')
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
      where.push('(error_message LIKE ? OR error_stack LIKE ? OR upstream_body LIKE ? OR path LIKE ?)')
      const like = `%${keyword}%`
      args.push(like, like, like, like)
    }
    if (resolvedFilter === '0' || resolvedFilter === '1') {
      where.push('is_resolved = ?')
      args.push(Number(resolvedFilter))
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
        `SELECT id, path, method, status, error_message, error_stack, error_stage,
                upstream_name, upstream_status, upstream_body,
                uid, client_ip, country, region, city, timezone, colo,
                user_agent, duration_ms, extra,
                is_resolved, resolved_at, resolved_by, resolved_note,
                created_at
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

// PATCH /api/admin/error-logs/{id}  body: { is_resolved: 0|1, resolved_note?: string }
//
// 标记一条错误日志为「已处理」或撤回。
// - 标为已处理：写入 resolved_at / resolved_by，note 可选
// - 撤回（is_resolved=0）：清掉 resolved_* 三个字段
//
// id 必须以「err_」开头（utils/error-log.js genId 用 crypto.randomUUID()，
// 实际是 36 位标准 UUID；为安全兜底，限制长度 ≤ 64 并禁止 / 等特殊字符）。
async function updateResolved(context, db, id) {
  const { request } = context
  const adminUid = context.data?.adminUid || null

  if (typeof id !== 'string' || id.length === 0 || id.length > 64 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return jsonError('日志 ID 格式错误', 400)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('请求体必须是 JSON', 400)
  }
  if (!body || typeof body !== 'object') return jsonError('请求体格式错误', 400)

  const flag = body.is_resolved
  if (flag !== 0 && flag !== 1) return jsonError('is_resolved 必须是 0 或 1', 400)

  // 备注长度兜底（前端 maxlength=200，DB 500）
  const note = typeof body.resolved_note === 'string' ? body.resolved_note.trim().slice(0, 200) : null

  // 与项目其他表保持一致：UTC 字符串、空格分隔、无 Z 后缀
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  try {
    if (flag === 1) {
      const r = await db
        .prepare(
          `UPDATE api_error_logs
             SET is_resolved = 1,
                 resolved_at = ?,
                 resolved_by = ?,
                 resolved_note = ?
           WHERE id = ?`,
        )
        .bind(now, adminUid, note, id)
        .run()
      if (!r.meta?.changes) return jsonError('日志不存在', 404)
    } else {
      const r = await db
        .prepare(
          `UPDATE api_error_logs
             SET is_resolved = 0,
                 resolved_at = NULL,
                 resolved_by = NULL,
                 resolved_note = NULL
           WHERE id = ?`,
        )
        .bind(id)
        .run()
      if (!r.meta?.changes) return jsonError('日志不存在', 404)
    }
    return json({ id, is_resolved: flag, resolved_at: flag === 1 ? now : null, resolved_note: note })
  } catch (error) {
    console.error('admin error-logs PATCH error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
