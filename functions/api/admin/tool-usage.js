// Admin 工具使用记录 API
//   GET /api/admin/tool-usage?page=1&pageSize=20&uid=...&tool_url=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//     鉴权：目录中间件 _middleware.js 已保证 admin
//     返回：明细 + 分页；每行附 ip_ban_id（该 IP 处于封禁中时为 ip_bans 行 id，
//     供前端展示「已封禁」标签与解封按钮，null 表示未封禁）
//     来源黑名单（tool_usage_source_blacklist）中的来源默认剔除，与统计口径一致；
//     记录本身保留在库中，解禁即恢复展示。
//   url_kind（记录类型筛选，可空）：
//     'tool'     = 仅站内工具（tool_url 不以 /app-jump/ 开头）
//     'app_jump' = 仅「更多应用」产品跳转（tool_url 以 /app-jump/ 开头，见 AppJump.vue 埋点）
//     不传 = 全部记录（行为与从前一致）
//
// 时间约定：used_at 是秒级时间戳，SQL 内统一用秒比较；
//   startDate/endDate 是 YYYY-MM-DD（本地 UTC+8），被解析为当天的 00:00:00 与次日 00:00:00（含当天）。
//
// 路由说明：本文件精确匹配 /api/admin/tool-usage（GET 明细列表）。
//   子路径 /api/admin/tool-usage/stats 单独走 stats.js，是 Cloudflare Pages Functions 的
//   拆分惯例（与 credits/transactions.js 一致）。

import { normalizeBanKey } from '../../utils/ip-ban.js'
import { loadSourceBlacklist, SOURCE_NOT_IN_BLACKLIST_R } from '../../utils/source-blacklist.js'

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

// 把 YYYY-MM-DD 解析为当天 UTC+8 00:00:00 的秒级时间戳；非法返回 null
function parseDateToUTC8Start(s) {
  if (!s || typeof s !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const [, y, mo, d] = m
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, 0, 0)
  return Math.floor((utc - 8 * 3600 * 1000) / 1000)
}

// 把 YYYY-MM-DD 解析为次日 UTC+8 00:00:00 的秒级时间戳（endDate 含当天）
function parseDateToUTC8NextDayStart(s) {
  const start = parseDateToUTC8Start(s)
  if (start == null) return null
  return start + 24 * 3600
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
    const uid = (url.searchParams.get('uid') || '').trim()
    const toolUrl = (url.searchParams.get('tool_url') || '').trim()
    // 推广来源筛选（与前端 SOURCE_LABELS 一致：direct / google / baidu / wechat ...）
    const source = (url.searchParams.get('source') || '').trim().toLowerCase()
    const startDate = parseDateToUTC8Start(url.searchParams.get('startDate'))
    const endDate = parseDateToUTC8NextDayStart(url.searchParams.get('endDate'))

    const where = []
    const args = []
    if (uid) {
      where.push('r.uid = ?')
      args.push(uid)
    }
    if (toolUrl) {
      where.push('r.tool_url = ?')
      args.push(toolUrl)
    }
    // 记录类型筛选：「更多应用」的产品跳转记录复用本表，tool_url 前缀 /app-jump/。
    // 取值白名单校验后拼字面量（LIKE 前缀匹配无用户输入，无注入面）
    const urlKind = (url.searchParams.get('url_kind') || '').trim()
    if (urlKind === 'tool') {
      where.push(`r.tool_url NOT LIKE '/app-jump/%'`)
    } else if (urlKind === 'app_jump') {
      where.push(`r.tool_url LIKE '/app-jump/%'`)
    }
    if (source) {
      where.push('r.source = ?')
      args.push(source)
    }
    if (startDate != null) {
      where.push('r.used_at >= ?')
      args.push(startDate)
    }
    if (endDate != null) {
      where.push('r.used_at < ?')
      args.push(endDate)
    }
    // 黑名单来源默认剔除（子查询 0 绑定参数，不受 D1 每查询 100 参数上限约束；
    // 表不存在时跳过，向后兼容未迁移环境）
    const blacklist = await loadSourceBlacklist(db)
    if (Array.isArray(blacklist) && blacklist.length) {
      where.push(SOURCE_NOT_IN_BLACKLIST_R)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM tool_usage_records r ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT r.id, r.uid, r.ip, r.tool_url, r.tool_title, r.used_at,
                r.country, r.region, r.city, r.timezone, r.colo, r.source,
                u.email AS user_email, u.username AS user_name
         FROM tool_usage_records r
         LEFT JOIN user u ON u.id = r.uid
         ${whereSql}
         ORDER BY r.used_at DESC, r.id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    // 标注每行 IP 是否处于封禁中（IPv6 记录按 /64 前缀匹配封禁键）
    let banIdByKey = new Map()
    try {
      const bans = await db
        .prepare(`SELECT id, ip FROM ip_bans WHERE expires_at IS NULL OR expires_at > datetime('now')`)
        .all()
      banIdByKey = new Map((bans.results || []).map((r) => [r.ip, r.id]))
    } catch (e) {
      // ip_bans 表未迁移时兜底：不标注，前端按未封禁处理
      console.warn('[admin/tool-usage] load ip_bans failed:', e?.message || e)
    }
    const rows = (list.results || []).map((r) => ({
      ...r,
      ip_ban_id: r.ip ? (banIdByKey.get(normalizeBanKey(r.ip)) ?? null) : null,
    }))

    const totalPages = Math.ceil(total / pageSize)

    return json({
      list: rows,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (err) {
    console.error('[admin/tool-usage] list error:', err)
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