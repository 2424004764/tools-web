// Admin 仪表盘统计 API
// GET /api/admin/dashboard
// 返回：用户总数、今日新增、禁用用户数、积分总余额、今日积分消耗、最近流水
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

    // 今日新增（按 UTC+8 自然日的 created_at 日期，与其余"今日"口径一致）
    const todayNewRow = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') = date('now', '+8 hours')",
      )
      .first()
    const todayNew = todayNewRow?.c || 0

    // 本周 / 本月新增 + 注册趋势（UTC+8 口径；user.created_at 是 UTC 时间字符串，
    // 与 tool_usage_records 的 unixepoch 不同，这里直接用 date(created_at, '+8 hours')）
    let weekNewUsers = 0
    let monthNewUsers = 0
    let userTrend = { daily: [], weekly: [], monthly: [] }
    try {
      const fmtDate = (d) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      const utc8 = new Date(Date.now() + 8 * 3600 * 1000)
      // 本周一（UTC+8 自然周，周一起算）
      const monday = new Date(utc8.getTime())
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
      const weekStartStr = fmtDate(monday)
      const monthStartStr = `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, '0')}-01`
      const weekNewRow = await db
        .prepare("SELECT COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') >= ?")
        .bind(weekStartStr)
        .first()
      weekNewUsers = weekNewRow?.c || 0
      const monthNewRow = await db
        .prepare("SELECT COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') >= ?")
        .bind(monthStartStr)
        .first()
      monthNewUsers = monthNewRow?.c || 0

      // 趋势：每日近 90 天 / 每周近 12 周（'-6 days' + 'weekday 1' 归到所在周周一）/ 每月近 12 个月
      // 返回稀疏点 { date, count }，前端按完整日期轴补零
      const dailyRes = await db
        .prepare(
          "SELECT date(created_at, '+8 hours') AS d, COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') >= ? GROUP BY d",
        )
        .bind(fmtDate(new Date(utc8.getTime() - 89 * 86400 * 1000)))
        .all()
      userTrend.daily = (dailyRes.results || []).map((r) => ({
        date: r.d,
        count: Number(r.c || 0),
      }))
      const weeklyRes = await db
        .prepare(
          "SELECT date(created_at, '+8 hours', '-6 days', 'weekday 1') AS d, COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') >= ? GROUP BY d",
        )
        .bind(fmtDate(new Date(monday.getTime() - 77 * 86400 * 1000)))
        .all()
      userTrend.weekly = (weeklyRes.results || []).map((r) => ({
        date: r.d,
        count: Number(r.c || 0),
      }))
      const month12Start = new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth() - 11, 1))
      const monthlyRes = await db
        .prepare(
          "SELECT strftime('%Y-%m', created_at, '+8 hours') AS m, COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') >= ? GROUP BY m",
        )
        .bind(fmtDate(month12Start))
        .all()
      userTrend.monthly = (monthlyRes.results || []).map((r) => ({
        date: r.m,
        count: Number(r.c || 0),
      }))
    } catch (e) {
      console.warn('[admin/dashboard] 用户增长聚合失败:', e?.message || e)
    }

    // 积分总余额 / 累计发放
    const creditsRow = await db
      .prepare('SELECT COALESCE(SUM(balance), 0) AS balance, COALESCE(SUM(total_earned), 0) AS earned, COUNT(*) AS active_users FROM user_credits')
      .first()
    const totalBalance = creditsRow?.balance || 0
    const totalEarned = creditsRow?.earned || 0
    const creditUsers = creditsRow?.active_users || 0

    // 今日积分消耗（按 UTC+8 自然日，仅统计实际扣费流水）
    const todayCreditSpentRow = await db
      .prepare(
        `SELECT COALESCE(SUM(ABS(amount)), 0) AS spent
         FROM credit_transactions
         WHERE type = 'deduct' AND date(created_at, '+8 hours') = date('now', '+8 hours')`,
      )
      .first()
    const todayCreditSpent = todayCreditSpentRow?.spent || 0

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

    // 待审核数：评论 / 友链 / 待处理反馈（依赖 comments / friend_links / feedback 表，未迁移兜底 0）
    let pendingComments = 0
    let pendingFriendLinks = 0
    let pendingFeedback = 0
    try {
      const pendingCommentsRow = await db
        .prepare("SELECT COUNT(*) AS c FROM comments WHERE status = 'pending' AND is_admin = 0")
        .first()
      pendingComments = pendingCommentsRow?.c || 0
      const pendingFriendLinksRow = await db
        .prepare("SELECT COUNT(*) AS c FROM friend_links WHERE status = 'pending'")
        .first()
      pendingFriendLinks = pendingFriendLinksRow?.c || 0
      const pendingFeedbackRow = await db
        .prepare("SELECT COUNT(*) AS c FROM feedback WHERE status = 'pending'")
        .first()
      pendingFeedback = pendingFeedbackRow?.c || 0
    } catch (e) {
      console.warn('[admin/dashboard] 待审核统计失败（可能表未创建）:', e?.message || e)
    }

    let pendingBlogPosts = 0
    try {
      const pendingBlogPostsRow = await db
        .prepare("SELECT COUNT(*) AS c FROM blog_posts WHERE status = 'pending'")
        .first()
      pendingBlogPosts = pendingBlogPostsRow?.c || 0
    } catch (e) {
      console.warn('[admin/dashboard] 待审核文章统计失败（可能表未创建）:', e?.message || e)
    }

    // 工具使用：今日 / 本周 / 本月 / TOP 5（依赖 tool_usage_records，可能因迁移未执行而抛错 → 兜底 0）
    let todayToolUsage = 0
    let weekToolUsage = 0
    let monthToolUsage = 0
    let totalToolUsage = 0
    let topTools = []
    // 使用趋势（UTC+8 口径）：每日近 90 天 / 每周近 12 周 / 每月近 12 个月
    // 返回稀疏点 { date, count }，前端按完整日期轴补零
    let usageTrend = { daily: [], weekly: [], monthly: [] }
    // 慢日志：今日 / 本周 / 本月（依赖 slow_query_logs 表，未迁移兜底 0）
    let slowQueryToday = 0
    let slowQueryWeek = 0
    let slowQueryMonth = 0
    try {
      const now = Date.now()
      const todayStartUTC8 = (() => {
        const utc8 = new Date(now + 8 * 3600 * 1000)
        const start = new Date(
          Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth(), utc8.getUTCDate(), 0, 0, 0),
        )
        return Math.floor((start.getTime() - 8 * 3600 * 1000) / 1000)
      })()
      const weekStartUTC8 = (() => {
        const utc8 = new Date(now + 8 * 3600 * 1000)
        const dow = utc8.getUTCDay()
        const daysSinceMonday = (dow + 6) % 7
        utc8.setUTCDate(utc8.getUTCDate() - daysSinceMonday)
        utc8.setUTCHours(0, 0, 0, 0)
        return Math.floor((utc8.getTime() - 8 * 3600 * 1000) / 1000)
      })()
      const monthStartUTC8 = (() => {
        const utc8 = new Date(now + 8 * 3600 * 1000)
        const start = new Date(
          Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth(), 1, 0, 0, 0),
        )
        return Math.floor((start.getTime() - 8 * 3600 * 1000) / 1000)
      })()
      const todayRow2 = await db
        .prepare('SELECT COUNT(*) AS c FROM tool_usage_records WHERE used_at >= ?')
        .bind(todayStartUTC8)
        .first()
      todayToolUsage = todayRow2?.c || 0
      const weekRow2 = await db
        .prepare('SELECT COUNT(*) AS c FROM tool_usage_records WHERE used_at >= ?')
        .bind(weekStartUTC8)
        .first()
      weekToolUsage = weekRow2?.c || 0
      const monthRow2 = await db
        .prepare('SELECT COUNT(*) AS c FROM tool_usage_records WHERE used_at >= ?')
        .bind(monthStartUTC8)
        .first()
      monthToolUsage = monthRow2?.c || 0
      const totalRow2 = await db.prepare('SELECT COUNT(*) AS c FROM tool_usage_records').first()
      totalToolUsage = totalRow2?.c || 0
      const topToolsResult = await db
        .prepare(
          `SELECT tool_url, tool_title, COUNT(*) AS count
           FROM tool_usage_records
           GROUP BY tool_url
           ORDER BY count DESC
           LIMIT 5`,
        )
        .all()
      topTools = (topToolsResult.results || []).map((r) => ({
        tool_url: r.tool_url,
        tool_title: r.tool_title,
        count: r.count,
      }))
      // 慢日志统计：created_at 是 UTC 'YYYY-MM-DD HH:mm:ss' 字符串，
      // 直接用 date(created_at, '+8 hours') 与 today/week/month 起始日期（UTC+8）字符串比对
      // 比起再算时间戳更直观，也避免时区边界误差。
      const todayDateStr = (() => {
        const utc8 = new Date(now + 8 * 3600 * 1000)
        return `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, '0')}-${String(utc8.getUTCDate()).padStart(2, '0')}`
      })()
      const weekStartDateStr = (() => {
        const utc8 = new Date(now + 8 * 3600 * 1000)
        const dow = utc8.getUTCDay()
        const daysSinceMonday = (dow + 6) % 7
        utc8.setUTCDate(utc8.getUTCDate() - daysSinceMonday)
        return `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, '0')}-${String(utc8.getUTCDate()).padStart(2, '0')}`
      })()
      const monthStartDateStr = (() => {
        const utc8 = new Date(now + 8 * 3600 * 1000)
        return `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, '0')}-01`
      })()
      const slowTodayRow = await db
        .prepare(
          `SELECT COUNT(*) AS c FROM slow_query_logs
           WHERE date(created_at, '+8 hours') >= ?`,
        )
        .bind(todayDateStr)
        .first()
      slowQueryToday = slowTodayRow?.c || 0
      const slowWeekRow = await db
        .prepare(
          `SELECT COUNT(*) AS c FROM slow_query_logs
           WHERE date(created_at, '+8 hours') >= ?`,
        )
        .bind(weekStartDateStr)
        .first()
      slowQueryWeek = slowWeekRow?.c || 0
      const slowMonthRow = await db
        .prepare(
          `SELECT COUNT(*) AS c FROM slow_query_logs
           WHERE date(created_at, '+8 hours') >= ?`,
        )
        .bind(monthStartDateStr)
        .first()
      slowQueryMonth = slowMonthRow?.c || 0

      // 使用趋势：'-6 days' + 'weekday 1' 把任意日期归到所在周的周一（UTC+8）
      // 每日返回近 90 天，前端用 dataZoom 初始只展示近 30 天、可向前滑动翻看
      const day90StartUTC8 = todayStartUTC8 - 89 * 86400
      const dailyTrendRes = await db
        .prepare(
          `SELECT date(used_at, 'unixepoch', '+8 hours') AS d, COUNT(*) AS c
           FROM tool_usage_records WHERE used_at >= ? GROUP BY d`,
        )
        .bind(day90StartUTC8)
        .all()
      usageTrend.daily = (dailyTrendRes.results || []).map((r) => ({
        date: r.d,
        count: Number(r.c || 0),
      }))

      const week12StartUTC8 = weekStartUTC8 - 11 * 7 * 86400
      const weeklyTrendRes = await db
        .prepare(
          `SELECT date(used_at, 'unixepoch', '+8 hours', '-6 days', 'weekday 1') AS d, COUNT(*) AS c
           FROM tool_usage_records WHERE used_at >= ? GROUP BY d`,
        )
        .bind(week12StartUTC8)
        .all()
      usageTrend.weekly = (weeklyTrendRes.results || []).map((r) => ({
        date: r.d,
        count: Number(r.c || 0),
      }))

      const month12StartUTC8 = (() => {
        const utc8 = new Date(now + 8 * 3600 * 1000)
        const start = new Date(
          Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth() - 11, 1, 0, 0, 0),
        )
        return Math.floor((start.getTime() - 8 * 3600 * 1000) / 1000)
      })()
      const monthlyTrendRes = await db
        .prepare(
          `SELECT strftime('%Y-%m', used_at, 'unixepoch', '+8 hours') AS m, COUNT(*) AS c
           FROM tool_usage_records WHERE used_at >= ? GROUP BY m`,
        )
        .bind(month12StartUTC8)
        .all()
      usageTrend.monthly = (monthlyTrendRes.results || []).map((r) => ({
        date: r.m,
        count: Number(r.c || 0),
      }))
    } catch (e) {
      // 迁移未执行等场景：兜底为 0，绝不阻塞仪表盘
      console.warn('[admin/dashboard] tool_usage / slow_query 聚合失败（可能表未创建）:', e?.message || e)
    }

    return json({
      totalUsers,
      todayNew,
      weekNewUsers,
      monthNewUsers,
      userTrend,
      disabledUsers,
      totalBalance,
      totalEarned,
      todayCreditSpent,
      creditUsers,
      recentTransactions: recentTx.results || [],
      tools: {
        total: toolStatsRow?.total || 0,
        enabled: toolStatsRow?.enabled || 0,
      },
      todayToolUsage,
      weekToolUsage,
      monthToolUsage,
      totalToolUsage,
      topTools,
      usageTrend,
      slowQueries: {
        today: slowQueryToday,
        week: slowQueryWeek,
        month: slowQueryMonth,
      },
      pendingComments,
      pendingFriendLinks,
      pendingBlogPosts,
      pendingFeedback,
    })
  } catch (error) {
    console.error('dashboard API error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}