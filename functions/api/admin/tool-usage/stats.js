// Admin 工具使用聚合统计 API
//   GET /api/admin/tool-usage/stats
//     鉴权：目录中间件 _middleware.js 已保证 admin
//     返回：今日/本周次数、活跃用户数、TOP 10 工具、TOP 10 用户
//
// 路由说明：精确匹配 /api/admin/tool-usage/stats，由 functions/_routes.json 注册。

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

// 本地 UTC+8 当天 00:00 的秒级时间戳
function startOfTodayUTC8() {
  const now = new Date()
  const utc8Now = new Date(now.getTime() + 8 * 3600 * 1000)
  const startUTC8 = new Date(
    Date.UTC(utc8Now.getUTCFullYear(), utc8Now.getUTCMonth(), utc8Now.getUTCDate(), 0, 0, 0),
  )
  return Math.floor((startUTC8.getTime() - 8 * 3600 * 1000) / 1000)
}

// 本地 UTC+8 本周（周一）00:00 的秒级时间戳
function startOfWeekUTC8() {
  const utc8Now = new Date(Date.now() + 8 * 3600 * 1000)
  const dayOfWeek = utc8Now.getUTCDay()
  const daysSinceMonday = (dayOfWeek + 6) % 7
  utc8Now.setUTCDate(utc8Now.getUTCDate() - daysSinceMonday)
  utc8Now.setUTCHours(0, 0, 0, 0)
  return Math.floor((utc8Now.getTime() - 8 * 3600 * 1000) / 1000)
}

// 秒级时间戳 → 本地 UTC+8 日期 'YYYY-MM-DD'（用于统计区间展示）
function tsToUTC8DateStr(sec) {
  if (!sec || !Number.isFinite(sec)) return null
  const d = new Date(sec * 1000 + 8 * 3600 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function onRequestGet(context) {
  const { env } = context
  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    const todayStart = startOfTodayUTC8()
    const weekStart = startOfWeekUTC8()

    const todayRow = await db
      .prepare('SELECT COUNT(*) AS c FROM tool_usage_records WHERE used_at >= ?')
      .bind(todayStart)
      .first()
    const todayCount = todayRow?.c || 0

    const weekRow = await db
      .prepare('SELECT COUNT(*) AS c FROM tool_usage_records WHERE used_at >= ?')
      .bind(weekStart)
      .first()
    const weekCount = weekRow?.c || 0

    const totalRow = await db
      .prepare('SELECT COUNT(*) AS c FROM tool_usage_records')
      .first()
    const totalCount = totalRow?.c || 0

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600
    const activeUsersRow = await db
      .prepare(
        'SELECT COUNT(DISTINCT uid) AS c FROM tool_usage_records WHERE used_at >= ?',
      )
      .bind(thirtyDaysAgo)
      .first()
    const activeUsers = activeUsersRow?.c || 0

    const topToolsResult = await db
      .prepare(
        `SELECT tool_url, tool_title, COUNT(*) AS use_count,
                MAX(used_at) AS last_used_at
         FROM tool_usage_records
         GROUP BY tool_url
         ORDER BY use_count DESC, last_used_at DESC
         LIMIT 10`,
      )
      .all()

    const topUsersResult = await db
      .prepare(
        `SELECT r.uid, COUNT(*) AS use_count, MAX(r.used_at) AS last_used_at,
                u.email AS user_email, u.username AS user_name
         FROM tool_usage_records r
         LEFT JOIN user u ON u.id = r.uid
         GROUP BY r.uid
         ORDER BY use_count DESC, last_used_at DESC
         LIMIT 10`,
      )
      .all()

    // 推广来源聚合（不区分 NULL 与 'direct'：迁移前的旧记录 source 为 NULL，
    //   用 COALESCE 归到 direct，避免后台出现两个 zero-count 项）
    const topSourcesResult = await db
      .prepare(
        `SELECT COALESCE(source, 'direct') AS source, COUNT(*) AS use_count,
                MAX(used_at) AS last_used_at,
                MIN(used_at) AS first_used_at
         FROM tool_usage_records
         GROUP BY source
         ORDER BY use_count DESC, last_used_at DESC
         LIMIT 10`,
      )
      .all()

    // 整张表的统计区间（用于前端展示「数据是何时到何时」）
    const rangeRow = await db
      .prepare('SELECT MIN(used_at) AS first_at, MAX(used_at) AS last_at FROM tool_usage_records')
      .first()
    const rangeStart = tsToUTC8DateStr(rangeRow?.first_at)
    const rangeEnd = tsToUTC8DateStr(rangeRow?.last_at)

    return json({
      todayCount,
      weekCount,
      totalCount,
      activeUsers30d: activeUsers,
      topTools: topToolsResult.results || [],
      topUsers: topUsersResult.results || [],
      topSources: topSourcesResult.results || [],
      rangeStart,
      rangeEnd,
    })
  } catch (err) {
    console.error('[admin/tool-usage] stats error:', err)
    return jsonError(err.message || '服务器错误', 500)
  }
}

// 仅接受 GET，其他方法 405
export async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  }
  return onRequestGet(context)
}