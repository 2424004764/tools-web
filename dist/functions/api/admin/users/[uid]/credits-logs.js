// Admin 单用户积分流水 API
// GET /api/admin/users/:uid/credits/logs?page=1&pageSize=20&type=grant|deduct
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
  const uid = context.params?.uid
  if (!uid) return jsonError('缺少用户 id', 400)

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const type = url.searchParams.get('type') // optional filter
  const offset = (page - 1) * pageSize

  try {
    const where = ['t.uid = ?']
    const args = [uid]
    if (type === 'grant' || type === 'deduct' || type === 'reset' || type === 'reverse') {
      where.push('t.type = ?')
      args.push(type)
    }
    const whereSql = `WHERE ${where.join(' AND ')}`

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM credit_transactions t ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT t.id, t.uid, t.type, t.amount, t.balance_after, t.reason,
                t.operator_uid, t.related_tx_id, t.created_at,
                op.email AS operator_email, op.username AS operator_name
         FROM credit_transactions t
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
    console.error('admin credits-logs error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}