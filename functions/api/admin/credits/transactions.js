// Admin 全局积分流水 API
// GET /api/admin/credits/transactions?page=1&pageSize=20&type=...&keyword=...&operatorUid=...
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

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const type = url.searchParams.get('type')
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const operatorUid = (url.searchParams.get('operatorUid') || '').trim()
  const offset = (page - 1) * pageSize

  try {
    const where = []
    const args = []
    if (type === 'grant' || type === 'deduct' || type === 'reverse') {
      where.push('t.type = ?')
      args.push(type)
    }
    if (operatorUid) {
      where.push('t.operator_uid = ?')
      args.push(operatorUid)
    }
    if (keyword) {
      // 搜索：用户 email / uid / 操作人 email / reason
      where.push(
        '(u_target.email LIKE ? OR t.uid LIKE ? OR op.email LIKE ? OR t.reason LIKE ?)',
      )
      const like = `%${keyword}%`
      args.push(like, like, like, like)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM credit_transactions t ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT t.id, t.uid, t.type, t.amount, t.balance_after, t.reason, t.source,
                t.operator_uid, t.related_tx_id, t.created_at,
                u_target.email AS user_email, u_target.username AS user_name,
                op.email AS operator_email, op.username AS operator_name
         FROM credit_transactions t
         LEFT JOIN user u_target ON u_target.id = t.uid
         LEFT JOIN user op ON op.id = t.operator_uid
         ${whereSql}
         ORDER BY t.created_at DESC, t.id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const totalPages = Math.ceil(total / pageSize)

    return json({
      list: list.results || [],
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
    console.error('admin credits/transactions error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}