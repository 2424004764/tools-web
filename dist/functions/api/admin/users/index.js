// Admin 用户列表 API
// GET /api/admin/users?page=1&pageSize=20&keyword=foo&disabled=0|1
// 返回：用户列表（分页）+ 每条记录的积分余额

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
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const disabled = url.searchParams.get('disabled') // '0' | '1' | null
  const offset = (page - 1) * pageSize

  try {
    // 构造 WHERE 子句
    const where = []
    const params = []
    if (keyword) {
      where.push('(email LIKE ? OR username LIKE ? OR id LIKE ?)')
      const like = `%${keyword}%`
      params.push(like, like, like)
    }
    if (disabled === '0' || disabled === '1') {
      where.push('is_disabled = ?')
      params.push(parseInt(disabled, 10))
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    // 总数
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM user ${whereSql}`)
      .bind(...params)
      .first()
    const total = totalRow?.c || 0

    // 列表（LEFT JOIN 积分表，缺失积分记录的用户余额=0）
    const list = await db
      .prepare(
        `SELECT u.id, u.email, u.username, u.avatar, u.is_admin, u.is_disabled,
                u.disabled_reason, u.disabled_at, u.created_at, u.last_login,
                COALESCE(c.balance, 0) AS credits_balance,
                COALESCE(c.total_earned, 0) AS credits_earned,
                COALESCE(c.total_spent, 0) AS credits_spent
         FROM user u
         LEFT JOIN user_credits c ON c.uid = u.id
         ${whereSql}
         ORDER BY u.created_at DESC, u.id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, pageSize, offset)
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
    console.error('admin/users list error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}