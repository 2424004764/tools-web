// Admin 仪表盘统计 API
// GET /api/admin/dashboard
// 返回：用户总数、今日新增、禁用用户数、积分总余额、最近流水
//
// 中间件 _middleware.js 已确保调用方为管理员，无需再做权限检查。

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
  try {
    // 用户总数
    const totalUsersRow = await db.prepare('SELECT COUNT(*) AS c FROM user').first()
    const totalUsers = totalUsersRow?.c || 0

    // 禁用用户数
    const disabledUsersRow = await db
      .prepare('SELECT COUNT(*) AS c FROM user WHERE is_disabled = 1')
      .first()
    const disabledUsers = disabledUsersRow?.c || 0

    // 今日新增（按 created_at 的日期）
    const todayNewRow = await db
      .prepare("SELECT COUNT(*) AS c FROM user WHERE date(created_at) = date('now')")
      .first()
    const todayNew = todayNewRow?.c || 0

    // 积分总余额 / 累计发放
    const creditsRow = await db
      .prepare('SELECT COALESCE(SUM(balance), 0) AS balance, COALESCE(SUM(total_earned), 0) AS earned, COUNT(*) AS active_users FROM user_credits')
      .first()
    const totalBalance = creditsRow?.balance || 0
    const totalEarned = creditsRow?.earned || 0
    const creditUsers = creditsRow?.active_users || 0

    // 最近 10 条流水（join user 取邮箱）
    const recentTx = await db
      .prepare(
        `SELECT t.id, t.uid, t.type, t.amount, t.balance_after, t.reason, t.source,
                t.operator_uid, t.created_at, u.email AS user_email, u.username AS user_name
         FROM credit_transactions t
         LEFT JOIN user u ON u.id = t.uid
         ORDER BY t.created_at DESC
         LIMIT 10`,
      )
      .all()

    // 工具启用数
    const toolStatsRow = await db
      .prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) AS enabled FROM tool_features')
      .first()

    return json({
      totalUsers,
      todayNew,
      disabledUsers,
      totalBalance,
      totalEarned,
      creditUsers,
      recentTransactions: recentTx.results || [],
      tools: {
        total: toolStatsRow?.total || 0,
        enabled: toolStatsRow?.enabled || 0,
      },
    })
  } catch (error) {
    console.error('dashboard API error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}