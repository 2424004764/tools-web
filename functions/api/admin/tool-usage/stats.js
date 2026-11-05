// Admin 工具使用聚合统计 API
//   GET /api/admin/tool-usage/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//     鉴权：目录中间件 _middleware.js 已保证 admin
//     返回：今日/本周次数、活跃用户数、TOP 10 工具、TOP 10 用户、全量来源统计
//     黑名单来源（tool_usage_source_blacklist）的记录不计入任何聚合，
//     单独返回 blockedCount / blockedSourceCount 供前端提示，记录本身仍在库中。
//     startDate/endDate（可选，UTC+8 自然日）：仅作用于来源统计（sources）与
//     被屏蔽次数（blockedCount），与明细列表口径一致，让「推广来源统计」跟随
//     后台的时间筛选（今天/本周/本月）；其余指标固定按整表/自身时间窗统计。
//
// 路由说明：精确匹配 /api/admin/tool-usage/stats（wrangler 按 functions 文件树自动生成路由）。

import {
  loadSourceBlacklist,
  SOURCE_NOT_IN_BLACKLIST,
  SOURCE_IN_BLACKLIST,
  SOURCE_NOT_IN_BLACKLIST_R,
} from '../../../utils/source-blacklist.js'

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

// 把 YYYY-MM-DD 解析为当天 UTC+8 00:00:00 的秒级时间戳；非法返回 null（与 tool-usage.js 一致）
function parseDateToUTC8Start(s) {
  if (!s || typeof s !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const [, y, mo, d] = m
  return Math.floor((Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, 0, 0) - 8 * 3600 * 1000) / 1000)
}

// 把 YYYY-MM-DD 解析为次日 UTC+8 00:00:00 的秒级时间戳（endDate 含当天）
function parseDateToUTC8NextDayStart(s) {
  const start = parseDateToUTC8Start(s)
  return start == null ? null : start + 24 * 3600
}

export async function onRequestGet(context) {
  const { request, env } = context
  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    // 来源统计的时间窗（可选，UTC+8 自然日；与明细列表同一口径）
    const url = new URL(request.url)
    const rangeStartDay = parseDateToUTC8Start(url.searchParams.get('startDate'))
    const rangeEndDay = parseDateToUTC8NextDayStart(url.searchParams.get('endDate'))
    const rangeWhere = []
    const rangeBinds = []
    if (rangeStartDay != null) {
      rangeWhere.push('used_at >= ?')
      rangeBinds.push(rangeStartDay)
    }
    if (rangeEndDay != null) {
      rangeWhere.push('used_at < ?')
      rangeBinds.push(rangeEndDay)
    }
    const rangeSql = rangeWhere.length ? ` AND ${rangeWhere.join(' AND ')}` : ''
    const todayStart = startOfTodayUTC8()
    const weekStart = startOfWeekUTC8()

    // 黑名单来源的记录不计入任何聚合（口径：COALESCE(source,'direct') 命中即剔除）。
    // 过滤用子查询（0 绑定参数）：D1 每查询最多 100 个绑定参数，
    // 逐个展开 NOT IN (?,...) 会在黑名单变大后触发 too many SQL variables。
    const blacklist = await loadSourceBlacklist(db)
    const hasBlacklistTable = Array.isArray(blacklist)
    const notIn = hasBlacklistTable ? ` AND ${SOURCE_NOT_IN_BLACKLIST}` : ''
    const whereNotIn = hasBlacklistTable ? ` WHERE ${SOURCE_NOT_IN_BLACKLIST}` : ''

    const todayRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM tool_usage_records WHERE used_at >= ?${notIn}`)
      .bind(todayStart)
      .first()
    const todayCount = todayRow?.c || 0

    const weekRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM tool_usage_records WHERE used_at >= ?${notIn}`)
      .bind(weekStart)
      .first()
    const weekCount = weekRow?.c || 0

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM tool_usage_records${whereNotIn}`)
      .first()
    const totalCount = totalRow?.c || 0

    // 被屏蔽记录数（单独统计，供前端展示「N 次记录未计入」；同样受时间窗约束）
    let blockedCount = 0
    if (hasBlacklistTable) {
      const blockedRow = await db
        .prepare(`SELECT COUNT(*) AS c FROM tool_usage_records WHERE ${SOURCE_IN_BLACKLIST}${rangeSql}`)
        .bind(...rangeBinds)
        .first()
      blockedCount = blockedRow?.c || 0
    }

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600
    const activeUsersRow = await db
      .prepare(
        `SELECT COUNT(DISTINCT uid) AS c FROM tool_usage_records WHERE used_at >= ?${notIn}`,
      )
      .bind(thirtyDaysAgo)
      .first()
    const activeUsers = activeUsersRow?.c || 0

    const topToolsResult = await db
      .prepare(
        `SELECT tool_url, tool_title, COUNT(*) AS use_count,
                MAX(used_at) AS last_used_at
         FROM tool_usage_records${whereNotIn}
         GROUP BY tool_url
         ORDER BY use_count DESC, last_used_at DESC
         LIMIT 10`,
      )
      .all()

    // topUsers 查询用了 r 别名，过滤条件需带 r. 前缀（COALESCE 里的裸 source 会优先解析成 user 表列名歧义）
    const whereNotInR = hasBlacklistTable ? ` WHERE ${SOURCE_NOT_IN_BLACKLIST_R}` : ''
    const topUsersResult = await db
      .prepare(
        `SELECT r.uid, COUNT(*) AS use_count, MAX(r.used_at) AS last_used_at,
                u.email AS user_email, u.username AS user_name
         FROM tool_usage_records r
         LEFT JOIN user u ON u.id = r.uid${whereNotInR}
         GROUP BY r.uid
         ORDER BY use_count DESC, last_used_at DESC
         LIMIT 10`,
      )
      .all()

    // 推广来源聚合：返回全量来源，前端按 SOURCE_CATEGORY_MEMBERS 分组
    //   并计算搜索引擎渠道合计（不区分 NULL 与 'direct'：迁移前的旧记录 source 为 NULL，
    //   用 COALESCE 归到 direct，避免后台出现两个 zero-count 项）。
    //   注意 GROUP BY 必须写 COALESCE 表达式而非别名/裸列：SQLite 的 GROUP BY source
    //   解析为原始列，NULL 与 'direct' 会分成两组（仅显示层 COALESCE，会出现两行「直接访问」）。
    //   受 startDate/endDate 时间窗约束（跟随后台时间筛选）；LIMIT 100 仅防御异常数据。
    const sourcesResult = await db
      .prepare(
        `SELECT COALESCE(source, 'direct') AS source, COUNT(*) AS use_count,
                MAX(used_at) AS last_used_at,
                MIN(used_at) AS first_used_at
         FROM tool_usage_records${whereNotIn}${rangeSql}
         GROUP BY COALESCE(source, 'direct')
         ORDER BY use_count DESC, last_used_at DESC
         LIMIT 100`,
      )
      .bind(...rangeBinds)
      .all()

    // 统计区间（与 totalCount 同口径：未屏蔽数据的 MIN/MAX，用于前端展示「数据是何时到何时」）
    const rangeRow = await db
      .prepare(`SELECT MIN(used_at) AS first_at, MAX(used_at) AS last_at FROM tool_usage_records${whereNotIn}`)
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
      sources: sourcesResult.results || [],
      blockedCount,
      blockedSourceCount: hasBlacklistTable ? blacklist.length : 0,
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