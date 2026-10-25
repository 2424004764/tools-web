// 仪表盘各面板的共享查询逻辑。
// 文件名以 _ 开头，Cloudflare Pages Functions 不会把它当路由。
//
// 使用方：
//   - ../index.js        聚合返回全部面板（兼容旧前端）
//   - ../[panel].js      按 panel 参数返回单个面板，供前端各卡片独立拉取

import { STORAGE_RESERVATION_TTL_SECONDS } from '../../../config/storage.js'

const EMPTY_TREND = { daily: [], weekly: [], monthly: [] }

function fmtDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function utc8Now() {
  return new Date(Date.now() + 8 * 3600 * 1000)
}

/** 今日 / 本周（周一起算）/ 本月的 UTC+8 起始时间戳（秒），用于 unixepoch 口径的表 */
function usageBoundaries(now = Date.now()) {
  const utc8 = new Date(now + 8 * 3600 * 1000)
  const todayStart = new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth(), utc8.getUTCDate(), 0, 0, 0))
  const weekStart = new Date(todayStart)
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7))
  const monthStart = new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth(), 1, 0, 0, 0))
  const toSec = (d) => Math.floor((d.getTime() - 8 * 3600 * 1000) / 1000)
  return { todayStart: toSec(todayStart), weekStart: toSec(weekStart), monthStart: toSec(monthStart) }
}

/** 概览卡片：用户总数 / 今日新增 / 禁用用户 / 积分 / 工具启用数 */
export async function getOverview(db) {
  const totalUsers = (await db.prepare('SELECT COUNT(*) AS c FROM user').first())?.c || 0
  const disabledUsers =
    (await db.prepare('SELECT COUNT(*) AS c FROM user WHERE is_disabled = 1').first())?.c || 0
  const todayNew =
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') = date('now', '+8 hours')",
        )
        .first()
    )?.c || 0

  const creditsRow = await db
    .prepare(
      'SELECT COALESCE(SUM(balance), 0) AS balance, COALESCE(SUM(total_earned), 0) AS earned, COUNT(*) AS active_users FROM user_credits',
    )
    .first()
  const todayCreditSpentRow = await db
    .prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) AS spent
       FROM credit_transactions
       WHERE type = 'deduct' AND date(created_at, '+8 hours') = date('now', '+8 hours')`,
    )
    .first()

  const toolStatsRow = await db
    .prepare(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) AS enabled FROM tool_features',
    )
    .first()

  return {
    totalUsers,
    todayNew,
    disabledUsers,
    totalBalance: creditsRow?.balance || 0,
    totalEarned: creditsRow?.earned || 0,
    creditUsers: creditsRow?.active_users || 0,
    todayCreditSpent: todayCreditSpentRow?.spent || 0,
    tools: {
      total: toolStatsRow?.total || 0,
      enabled: toolStatsRow?.enabled || 0,
    },
  }
}

/** 用户注册趋势（UTC+8 口径）：今日/本周/本月新增 + 每日/每周/每月稀疏点，窗口大小由 opts 控制（前端拉到最左可翻倍加载更早） */
export async function getUserTrend(db, opts = {}) {
  const dailyDays = opts.dailyDays || 90
  const weeklyWeeks = opts.weeklyWeeks || 12
  const monthlyMonths = opts.monthlyMonths || 12
  let weekNewUsers = 0
  let monthNewUsers = 0
  let userTrend = { ...EMPTY_TREND, daily: [], weekly: [], monthly: [] }
  try {
    const utc8 = utc8Now()
    const monday = new Date(utc8.getTime())
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
    const weekStartStr = fmtDate(monday)
    const monthStartStr = `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, '0')}-01`

    weekNewUsers =
      (
        await db
          .prepare("SELECT COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') >= ?")
          .bind(weekStartStr)
          .first()
      )?.c || 0
    monthNewUsers =
      (
        await db
          .prepare("SELECT COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') >= ?")
          .bind(monthStartStr)
          .first()
      )?.c || 0

    const dailyRes = await db
      .prepare(
        "SELECT date(created_at, '+8 hours') AS d, COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') >= ? GROUP BY d",
      )
      .bind(fmtDate(new Date(utc8.getTime() - (dailyDays - 1) * 86400 * 1000)))
      .all()
    userTrend.daily = (dailyRes.results || []).map((r) => ({ date: r.d, count: Number(r.c || 0) }))

    const weeklyRes = await db
      .prepare(
        "SELECT date(created_at, '+8 hours', '-6 days', 'weekday 1') AS d, COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') >= ? GROUP BY d",
      )
      .bind(fmtDate(new Date(monday.getTime() - (weeklyWeeks - 1) * 7 * 86400 * 1000)))
      .all()
    userTrend.weekly = (weeklyRes.results || []).map((r) => ({ date: r.d, count: Number(r.c || 0) }))

    const monthNStart = new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth() - (monthlyMonths - 1), 1))
    const monthlyRes = await db
      .prepare(
        "SELECT strftime('%Y-%m', created_at, '+8 hours') AS m, COUNT(*) AS c FROM user WHERE date(created_at, '+8 hours') >= ? GROUP BY m",
      )
      .bind(fmtDate(monthNStart))
      .all()
    userTrend.monthly = (monthlyRes.results || []).map((r) => ({ date: r.m, count: Number(r.c || 0) }))
  } catch (e) {
    console.warn('[admin/dashboard] 用户增长聚合失败:', e?.message || e)
  }
  return { weekNewUsers, monthNewUsers, userTrend }
}

/** 工具使用：今日/本周/本月/累计 + 使用趋势稀疏点，窗口大小由 opts 控制（前端拉到最左可翻倍加载更早） */
export async function getUsage(db, opts = {}) {
  const dailyDays = opts.dailyDays || 90
  const weeklyWeeks = opts.weeklyWeeks || 12
  const monthlyMonths = opts.monthlyMonths || 12
  let todayToolUsage = 0
  let weekToolUsage = 0
  let monthToolUsage = 0
  let totalToolUsage = 0
  let usageTrend = { daily: [], weekly: [], monthly: [] }
  try {
    const { todayStart, weekStart, monthStart } = usageBoundaries()
    todayToolUsage =
      (await db.prepare('SELECT COUNT(*) AS c FROM tool_usage_records WHERE used_at >= ?').bind(todayStart).first())?.c || 0
    weekToolUsage =
      (await db.prepare('SELECT COUNT(*) AS c FROM tool_usage_records WHERE used_at >= ?').bind(weekStart).first())?.c || 0
    monthToolUsage =
      (await db.prepare('SELECT COUNT(*) AS c FROM tool_usage_records WHERE used_at >= ?').bind(monthStart).first())?.c || 0
    totalToolUsage = (await db.prepare('SELECT COUNT(*) AS c FROM tool_usage_records').first())?.c || 0

    const day90StartUTC8 = todayStart - (dailyDays - 1) * 86400
    const dailyTrendRes = await db
      .prepare(
        `SELECT date(used_at, 'unixepoch', '+8 hours') AS d, COUNT(*) AS c
         FROM tool_usage_records WHERE used_at >= ? GROUP BY d`,
      )
      .bind(day90StartUTC8)
      .all()
    usageTrend.daily = (dailyTrendRes.results || []).map((r) => ({ date: r.d, count: Number(r.c || 0) }))

    const weekNStartUTC8 = weekStart - (weeklyWeeks - 1) * 7 * 86400
    const weeklyTrendRes = await db
      .prepare(
        `SELECT date(used_at, 'unixepoch', '+8 hours', '-6 days', 'weekday 1') AS d, COUNT(*) AS c
         FROM tool_usage_records WHERE used_at >= ? GROUP BY d`,
      )
      .bind(weekNStartUTC8)
      .all()
    usageTrend.weekly = (weeklyTrendRes.results || []).map((r) => ({ date: r.d, count: Number(r.c || 0) }))

    const utc8 = utc8Now()
    const monthNStartUTC8 = (() => {
      const start = new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth() - (monthlyMonths - 1), 1, 0, 0, 0))
      return Math.floor((start.getTime() - 8 * 3600 * 1000) / 1000)
    })()
    const monthlyTrendRes = await db
      .prepare(
        `SELECT strftime('%Y-%m', used_at, 'unixepoch', '+8 hours') AS m, COUNT(*) AS c
         FROM tool_usage_records WHERE used_at >= ? GROUP BY m`,
      )
      .bind(monthNStartUTC8)
      .all()
    usageTrend.monthly = (monthlyTrendRes.results || []).map((r) => ({ date: r.m, count: Number(r.c || 0) }))
  } catch (e) {
    console.warn('[admin/dashboard] tool_usage 聚合失败（可能表未创建）:', e?.message || e)
  }
  return { todayToolUsage, weekToolUsage, monthToolUsage, totalToolUsage, usageTrend }
}

/** TOP 10 工具：今日 / 本周 / 本月 / 累计 四个窗口，供前端切换 */
export async function getTopTools(db) {
  const topTools = { daily: [], weekly: [], monthly: [], all: [] }
  try {
    const { todayStart, weekStart, monthStart } = usageBoundaries()
    const query = async (since) => {
      const res = await db
        .prepare(
          `SELECT tool_url, tool_title, COUNT(*) AS count
           FROM tool_usage_records
           ${since == null ? '' : 'WHERE used_at >= ?'}
           GROUP BY tool_url
           ORDER BY count DESC
           LIMIT 10`,
        )
        .bind(...(since == null ? [] : [since]))
        .all()
      return (res.results || []).map((r) => ({
        tool_url: r.tool_url,
        tool_title: r.tool_title,
        count: r.count,
      }))
    }
    topTools.all = await query(null)
    topTools.daily = await query(todayStart)
    topTools.weekly = await query(weekStart)
    topTools.monthly = await query(monthStart)
  } catch (e) {
    console.warn('[admin/dashboard] topTools 聚合失败（可能表未创建）:', e?.message || e)
  }
  return { topTools }
}

/** 活跃用户（来自 tool_usage_records）
 *  - 排名模式（不传 uid）：各窗口活跃人数（去重 uid）+ 各窗口使用次数 TOP 10 用户
 *  - 单用户模式（opts.uid）：该用户各窗口使用次数 + 使用趋势稀疏点（口径与 getUsage 一致） */
export async function getActiveUsers(db, opts = {}) {
  const dailyDays = opts.dailyDays || 90
  const weeklyWeeks = opts.weeklyWeeks || 12
  const monthlyMonths = opts.monthlyMonths || 12
  try {
    const { todayStart, weekStart, monthStart } = usageBoundaries()
    const utc8 = utc8Now()
    const monthNStartUTC8 = (() => {
      const start = new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth() - (monthlyMonths - 1), 1, 0, 0, 0))
      return Math.floor((start.getTime() - 8 * 3600 * 1000) / 1000)
    })()

    if (opts.uid) {
      // 单用户模式：窗口计数 + 三粒度趋势，一次 batch 出结果
      const countSql = 'SELECT COUNT(*) AS c FROM tool_usage_records WHERE uid = ?'
      const stmts = [
        db.prepare(`${countSql} AND used_at >= ?`).bind(opts.uid, todayStart),
        db.prepare(`${countSql} AND used_at >= ?`).bind(opts.uid, weekStart),
        db.prepare(`${countSql} AND used_at >= ?`).bind(opts.uid, monthStart),
        db.prepare(countSql).bind(opts.uid),
        db
          .prepare(
            `SELECT date(used_at, 'unixepoch', '+8 hours') AS d, COUNT(*) AS c
             FROM tool_usage_records WHERE uid = ? AND used_at >= ? GROUP BY d`,
          )
          .bind(opts.uid, todayStart - (dailyDays - 1) * 86400),
        db
          .prepare(
            `SELECT date(used_at, 'unixepoch', '+8 hours', '-6 days', 'weekday 1') AS d, COUNT(*) AS c
             FROM tool_usage_records WHERE uid = ? AND used_at >= ? GROUP BY d`,
          )
          .bind(opts.uid, weekStart - (weeklyWeeks - 1) * 7 * 86400),
        db
          .prepare(
            `SELECT strftime('%Y-%m', used_at, 'unixepoch', '+8 hours') AS m, COUNT(*) AS c
             FROM tool_usage_records WHERE uid = ? AND used_at >= ? GROUP BY m`,
          )
          .bind(opts.uid, monthNStartUTC8),
      ]
      const rows = await db.batch(stmts)
      const num = (i) => Number(rows[i]?.results?.[0]?.c) || 0
      const toPoints = (i) =>
        (rows[i]?.results || []).map((r) => ({ date: r.d || r.m, count: Number(r.c || 0) }))
      return {
        activeUserUsage: { daily: num(0), weekly: num(1), monthly: num(2), all: num(3) },
        activeUserTrend: { daily: toPoints(4), weekly: toPoints(5), monthly: toPoints(6) },
      }
    }

    // 排名模式：各窗口去重人数 + TOP 10 用户（LEFT JOIN 取用户名/邮箱，删除用户仍可展示 uid）
    const distinctSql = 'SELECT COUNT(DISTINCT uid) AS c FROM tool_usage_records'
    const rankQuery = (since) =>
      db
        .prepare(
          `SELECT r.uid, u.username AS user_name, u.email AS user_email, COUNT(*) AS count
           FROM tool_usage_records r
           LEFT JOIN user u ON u.id = r.uid
           ${since == null ? '' : 'WHERE r.used_at >= ?'}
           GROUP BY r.uid
           ORDER BY count DESC
           LIMIT 10`,
        )
        .bind(...(since == null ? [] : [since]))
    const windows = [
      ['daily', todayStart],
      ['weekly', weekStart],
      ['monthly', monthStart],
      ['all', null],
    ]
    const rows = await db.batch(
      windows.flatMap(([key, since]) => [
        db.prepare(`${distinctSql} ${since == null ? '' : 'WHERE used_at >= ?'}`).bind(...(since == null ? [] : [since])),
        rankQuery(since),
      ]),
    )
    const activeUserCounts = {}
    const activeUsers = {}
    windows.forEach(([key], i) => {
      activeUserCounts[key] = Number(rows[i * 2]?.results?.[0]?.c) || 0
      activeUsers[key] = (rows[i * 2 + 1]?.results || []).map((r) => ({
        uid: r.uid,
        user_name: r.user_name || '',
        user_email: r.user_email || '',
        count: Number(r.count || 0),
      }))
    })
    return { activeUserCounts, activeUsers }
  } catch (e) {
    console.warn('[admin/dashboard] activeUsers 聚合失败（可能表未创建）:', e?.message || e)
    return {
      activeUserCounts: { daily: 0, weekly: 0, monthly: 0, all: 0 },
      activeUsers: { daily: [], weekly: [], monthly: [], all: [] },
    }
  }
}

/** 慢日志：今日 / 本周 / 本月 */
export async function getSlowQueries(db) {
  let slowQueryToday = 0
  let slowQueryWeek = 0
  let slowQueryMonth = 0
  try {
    const utc8 = utc8Now()
    const todayDateStr = fmtDate(utc8)
    const weekStart = new Date(utc8.getTime())
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7))
    const weekStartDateStr = fmtDate(weekStart)
    const monthStartDateStr = `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, '0')}-01`

    slowQueryToday =
      (
        await db
          .prepare(`SELECT COUNT(*) AS c FROM slow_query_logs WHERE date(created_at, '+8 hours') >= ?`)
          .bind(todayDateStr)
          .first()
      )?.c || 0
    slowQueryWeek =
      (
        await db
          .prepare(`SELECT COUNT(*) AS c FROM slow_query_logs WHERE date(created_at, '+8 hours') >= ?`)
          .bind(weekStartDateStr)
          .first()
      )?.c || 0
    slowQueryMonth =
      (
        await db
          .prepare(`SELECT COUNT(*) AS c FROM slow_query_logs WHERE date(created_at, '+8 hours') >= ?`)
          .bind(monthStartDateStr)
          .first()
      )?.c || 0
  } catch (e) {
    console.warn('[admin/dashboard] slow_query 聚合失败（可能表未创建）:', e?.message || e)
  }
  return { slowQueries: { today: slowQueryToday, week: slowQueryWeek, month: slowQueryMonth } }
}

/** 待审核：评论 / 友链 / 文章 / 反馈 */
export async function getPending(db) {
  let pendingComments = 0
  let pendingFriendLinks = 0
  let pendingFeedback = 0
  let pendingBlogPosts = 0
  try {
    pendingComments =
      (
        await db
          .prepare("SELECT COUNT(*) AS c FROM comments WHERE status = 'pending' AND is_admin = 0")
          .first()
      )?.c || 0
    pendingFriendLinks =
      (await db.prepare("SELECT COUNT(*) AS c FROM friend_links WHERE status = 'pending'").first())?.c || 0
    pendingFeedback =
      (await db.prepare("SELECT COUNT(*) AS c FROM feedback WHERE status = 'pending'").first())?.c || 0
  } catch (e) {
    console.warn('[admin/dashboard] 待审核统计失败（可能表未创建）:', e?.message || e)
  }
  try {
    pendingBlogPosts =
      (await db.prepare("SELECT COUNT(*) AS c FROM blog_posts WHERE status = 'pending'").first())?.c || 0
  } catch (e) {
    console.warn('[admin/dashboard] 待审核文章统计失败（可能表未创建）:', e?.message || e)
  }
  return { pendingComments, pendingFriendLinks, pendingBlogPosts, pendingFeedback }
}

/** 最近 10 条积分流水 */
export async function getTransactions(db) {
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
  return { recentTransactions: recentTx.results || [] }
}

/** 存储空间：已发放总空间 / 已使用 / 预扣（有效上传预留）/ 可用 + 来源拆解（口径与 admin/storage 一致）
 *  + 新增占用趋势（每日/每周/每月，三张来源表按 created_at 归组的字节增量，窗口大小由 opts 控制） */
export async function getStorage(db, opts = {}) {
  const dailyDays = opts.dailyDays || 90
  const weeklyWeeks = opts.weeklyWeeks || 12
  const monthlyMonths = opts.monthlyMonths || 12
  const emptyStorage = {
    quotaBytes: 0,
    usedBytes: 0,
    pendingBytes: 0,
    pendingCount: 0,
    availableBytes: 0,
    users: 0,
    sources: {
      music: { count: 0, bytes: 0 },
      aiCreation: { count: 0, bytes: 0 },
      subsite: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 },
    },
  }
  try {
    // 趋势窗口边界（UTC+8 口径，与 getUserTrend 一致）
    const utc8 = utc8Now()
    const monday = new Date(utc8.getTime())
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
    const dailyStart = fmtDate(new Date(utc8.getTime() - (dailyDays - 1) * 86400 * 1000))
    const weeklyStart = fmtDate(new Date(monday.getTime() - (weeklyWeeks - 1) * 7 * 86400 * 1000))
    const monthlyStart = fmtDate(new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth() - (monthlyMonths - 1), 1)))

    // 新增占用趋势：音乐 / AI 图 / 子站三表 UNION 后按周期归组求和（子站仅取 settled，与来源拆解口径一致）
    // WHERE 统一用日级表达式比较（月度口径若拿 'YYYY-MM' 分组值与 'YYYY-MM-01' 比较，会错把起始月整月排除）
    const trendQuery = (groupExpr) => {
      const sub = (table, sizeExpr, extraWhere = '') =>
        `SELECT ${groupExpr} AS d, ${sizeExpr} AS s FROM ${table} WHERE ${extraWhere ? extraWhere + ' AND ' : ''}date(created_at, '+8 hours') >= ?`
      return `SELECT d, SUM(s) AS c FROM (
        ${sub('music_songs', 'file_size')}
        UNION ALL ${sub('ai_creation_images', 'file_size')}
        UNION ALL ${sub('subsite_uploads', 'COALESCE(actual_bytes, declared_bytes)', "status = 'settled'")}
      ) GROUP BY d`
    }
    const dailyExpr = "date(created_at, '+8 hours')"
    const weeklyExpr = "date(created_at, '+8 hours', '-6 days', 'weekday 1')"
    const monthlyExpr = "strftime('%Y-%m', created_at, '+8 hours')"

    const [quotaRow, pendingRow, musicRow, aiRow, subsiteRow, dailyTrendRes, weeklyTrendRes, monthlyTrendRes] =
      await db.batch([
        db.prepare(
          `SELECT COALESCE(SUM(quota_bytes), 0) AS quota, COALESCE(SUM(used_bytes), 0) AS used, COUNT(*) AS users
           FROM user_storage_quota`,
        ),
        db.prepare(
          `SELECT COUNT(*) AS c, COALESCE(SUM(bytes), 0) AS pending FROM storage_reservations
           WHERE created_at >= datetime('now', '-${STORAGE_RESERVATION_TTL_SECONDS} seconds')`,
        ),
        db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS s FROM music_songs`),
        db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS s FROM ai_creation_images`),
        db.prepare(
          `SELECT COUNT(*) AS c, COALESCE(SUM(COALESCE(actual_bytes, declared_bytes)), 0) AS s
           FROM subsite_uploads WHERE status = 'settled'`,
        ),
        db.prepare(trendQuery(dailyExpr)).bind(dailyStart, dailyStart, dailyStart),
        db.prepare(trendQuery(weeklyExpr)).bind(weeklyStart, weeklyStart, weeklyStart),
        db.prepare(trendQuery(monthlyExpr)).bind(monthlyStart, monthlyStart, monthlyStart),
      ])
    const quotaBytes = Number(quotaRow?.results?.[0]?.quota) || 0
    const usedBytes = Number(quotaRow?.results?.[0]?.used) || 0
    const pendingBytes = Number(pendingRow?.results?.[0]?.pending) || 0
    const sources = {
      music: { count: Number(musicRow?.results?.[0]?.c) || 0, bytes: Number(musicRow?.results?.[0]?.s) || 0 },
      aiCreation: { count: Number(aiRow?.results?.[0]?.c) || 0, bytes: Number(aiRow?.results?.[0]?.s) || 0 },
      subsite: { count: Number(subsiteRow?.results?.[0]?.c) || 0, bytes: Number(subsiteRow?.results?.[0]?.s) || 0 },
    }
    const identified = sources.music.bytes + sources.aiCreation.bytes + sources.subsite.bytes
    const toPoints = (res) => (res?.results || []).map((r) => ({ date: r.d, count: Number(r.c || 0) }))
    return {
      storage: {
        quotaBytes,
        usedBytes,
        pendingBytes,
        pendingCount: Number(pendingRow?.results?.[0]?.c) || 0,
        availableBytes: Math.max(0, quotaBytes - usedBytes - pendingBytes),
        users: Number(quotaRow?.results?.[0]?.users) || 0,
        sources: {
          ...sources,
          // 已用减去可归集来源：生成图持久化、购物清单图片等未逐文件归集的部分
          other: { count: 0, bytes: Math.max(0, usedBytes - identified) },
        },
      },
      storageTrend: {
        daily: toPoints(dailyTrendRes),
        weekly: toPoints(weeklyTrendRes),
        monthly: toPoints(monthlyTrendRes),
      },
    }
  } catch (e) {
    console.warn('[admin/dashboard] 存储聚合失败（可能表未创建）:', e?.message || e)
    return { storage: emptyStorage, storageTrend: { ...EMPTY_TREND, daily: [], weekly: [], monthly: [] } }
  }
}

/** 网站访问（站点级 PV，site_visits 表）：今日/本周/本月/累计 + 趋势稀疏点 + 页面 TOP，口径与 getUsage 一致 */
export async function getSiteVisits(db, opts = {}) {
  const dailyDays = opts.dailyDays || 90
  const weeklyWeeks = opts.weeklyWeeks || 12
  const monthlyMonths = opts.monthlyMonths || 12
  let todaySiteVisits = 0
  let weekSiteVisits = 0
  let monthSiteVisits = 0
  let totalSiteVisits = 0
  let siteVisitTrend = { daily: [], weekly: [], monthly: [] }
  let topPages = []
  try {
    const { todayStart, weekStart, monthStart } = usageBoundaries()
    todaySiteVisits =
      (await db.prepare('SELECT COUNT(*) AS c FROM site_visits WHERE visited_at >= ?').bind(todayStart).first())?.c || 0
    weekSiteVisits =
      (await db.prepare('SELECT COUNT(*) AS c FROM site_visits WHERE visited_at >= ?').bind(weekStart).first())?.c || 0
    monthSiteVisits =
      (await db.prepare('SELECT COUNT(*) AS c FROM site_visits WHERE visited_at >= ?').bind(monthStart).first())?.c || 0
    totalSiteVisits = (await db.prepare('SELECT COUNT(*) AS c FROM site_visits').first())?.c || 0

    const dayNStartUTC8 = todayStart - (dailyDays - 1) * 86400
    const dailyTrendRes = await db
      .prepare(
        `SELECT date(visited_at, 'unixepoch', '+8 hours') AS d, COUNT(*) AS c
         FROM site_visits WHERE visited_at >= ? GROUP BY d`,
      )
      .bind(dayNStartUTC8)
      .all()
    siteVisitTrend.daily = (dailyTrendRes.results || []).map((r) => ({ date: r.d, count: Number(r.c || 0) }))

    const weekNStartUTC8 = weekStart - (weeklyWeeks - 1) * 7 * 86400
    const weeklyTrendRes = await db
      .prepare(
        `SELECT date(visited_at, 'unixepoch', '+8 hours', '-6 days', 'weekday 1') AS d, COUNT(*) AS c
         FROM site_visits WHERE visited_at >= ? GROUP BY d`,
      )
      .bind(weekNStartUTC8)
      .all()
    siteVisitTrend.weekly = (weeklyTrendRes.results || []).map((r) => ({ date: r.d, count: Number(r.c || 0) }))

    const utc8 = utc8Now()
    const monthNStartUTC8 = (() => {
      const start = new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth() - (monthlyMonths - 1), 1, 0, 0, 0))
      return Math.floor((start.getTime() - 8 * 3600 * 1000) / 1000)
    })()
    const monthlyTrendRes = await db
      .prepare(
        `SELECT strftime('%Y-%m', visited_at, 'unixepoch', '+8 hours') AS m, COUNT(*) AS c
         FROM site_visits WHERE visited_at >= ? GROUP BY m`,
      )
      .bind(monthNStartUTC8)
      .all()
    siteVisitTrend.monthly = (monthlyTrendRes.results || []).map((r) => ({ date: r.m, count: Number(r.c || 0) }))

    const topPagesRes = await db
      .prepare(
        `SELECT path, COUNT(*) AS count
         FROM site_visits
         GROUP BY path
         ORDER BY count DESC
         LIMIT 10`,
      )
      .all()
    topPages = (topPagesRes.results || []).map((r) => ({ path: r.path, count: r.count }))
  } catch (e) {
    console.warn('[admin/dashboard] site_visits 聚合失败（可能表未创建）:', e?.message || e)
  }
  return { todaySiteVisits, weekSiteVisits, monthSiteVisits, totalSiteVisits, siteVisitTrend, topPages }
}

/** 面板名 → 查询函数 */
export const PANEL_QUERIES = {
  overview: getOverview,
  storage: getStorage,
  userTrend: getUserTrend,
  usage: getUsage,
  siteVisit: getSiteVisits,
  activeUsers: getActiveUsers,
  topTools: getTopTools,
  slowlog: getSlowQueries,
  pending: getPending,
  transactions: getTransactions,
}
