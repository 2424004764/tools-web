// Admin 生成记录 API
// GET /api/admin/generation-records?page=1&pageSize=20&status=...&source=...&uid=...&keyword=...
//
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

const VALID_STATUS = ['in_progress', 'success', 'failed', 'timeout', 'reversed']

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const status = (url.searchParams.get('status') || '').trim()
  const source = (url.searchParams.get('source') || '').trim()
  const uid = (url.searchParams.get('uid') || '').trim()
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const offset = (page - 1) * pageSize

  try {
    const where = []
    const args = []
    if (status && VALID_STATUS.includes(status)) {
      where.push('r.status = ?')
      args.push(status)
    }
    if (source) {
      where.push('r.source = ?')
      args.push(source)
    }
    if (uid) {
      where.push('r.uid = ?')
      args.push(uid)
    }
    if (keyword) {
      // 搜索：model / error_message / raw_data.prompt
      where.push(
        '(r.model LIKE ? OR r.error_message LIKE ? OR json_extract(r.raw_data, \'$.prompt\') LIKE ?)',
      )
      const like = `%${keyword}%`
      args.push(like, like, like)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM generation_records r ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT r.id, r.uid, r.source, r.mode, r.model, r.status, r.cost,
                r.result_url, r.error_message, r.duration_ms, r.upstream_duration_ms,
                r.upstream_status, r.idempotency_key, r.tx_id, r.raw_data, r.created_at,
                u.email AS user_email, u.username AS user_name
         FROM generation_records r
         LEFT JOIN user u ON u.id = r.uid
         ${whereSql}
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const totalPages = Math.ceil(total / pageSize)

    // raw_data 是字符串，前端按需 JSON.parse；这里直接返回
    const items = (list.results || []).map((row) => ({
      ...row,
      // 预解析 raw_data 方便前端用 computed 取字段；解析失败回退为字符串
      raw_data_parsed: safeParse(row.raw_data),
    }))

    return json({
      list: items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('admin generation-records error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}

function safeParse(str) {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}