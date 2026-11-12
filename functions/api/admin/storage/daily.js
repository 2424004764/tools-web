// Admin 存储空间按天用量明细 API
// GET /api/admin/storage/daily    query: date(YYYY-MM-DD, UTC+8), page, pageSize, keyword [, uid]
//
// 不带 uid：某天的全站口径
//   summary  当日新增占用（字节 / 文件数 / 用户数）+ 四来源拆解
//   trend    近 N 天（默认 30，可用 trendDays 调整 7-90）每日新增用量（零填充，含文件数 / 用户数）
//   list     当日按用户聚合的用量行（分页 / 搜索，按当日新增降序）
// 带 uid：该用户当天的逐文件记录（音乐 + AI 图 + 购物清单图合并 files，子站上传单独 uploads）
//
// 口径说明（与 dashboard getStorage 趋势一致，日界按 UTC+8）：
//   music_songs                     file_size
//   ai_creation_images              file_size
//   subsite_uploads                 COALESCE(actual_bytes, declared_bytes)，仅 settled（实扣口径）
//   shopping_list_image_uploads     COALESCE(actual_bytes, declared_bytes)，仅 confirmed（实扣口径）
//   生成图持久化（generated-images）不落文件表，无法按天归集，前端有口径提示；
//   各表记录随文件删除会消失，故「当天用了多少」以现存记录为准（删除不回溯）。
//
// 容错：线上 D1 可能尚未跑齐全部迁移，缺的来源表自动跳过（该来源计 0），
//   缺表名放进响应 missingTables 提示管理员补迁移，而不是整页报错。
//
// 鉴权：/api/admin/_middleware.js 已校验管理员，这里无需重复检查。

import { likeContains } from '../../../utils/like.js'

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

function intOr0(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** UTC+8 的今天（YYYY-MM-DD） */
function utc8Today() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/** 某日起往前数 n 天的起始日（YYYY-MM-DD，均在 UTC+8 轴上计算） */
function utc8DaysAgo(n) {
  return new Date(Date.now() + 8 * 3600 * 1000 - n * 86400 * 1000).toISOString().slice(0, 10)
}

/** 零填充趋势：把稀疏的 GROUP BY 结果铺满 [start, today] 每一天，便于前端画可点击日条 */
function fillTrend(points, start, end) {
  const map = new Map(points.map((p) => [p.date, p]))
  const days = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cursor <= last) {
    const d = cursor.toISOString().slice(0, 10)
    const p = map.get(d)
    days.push({ date: d, bytes: p ? p.bytes : 0, files: p ? p.files : 0, users: p ? p.users : 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

/** 四个按天来源表（key 与前端来源拆解一一对应） */
const DAY_SOURCES = [
  { key: 'music', table: 'music_songs', sizeExpr: 'file_size', extraWhere: '' },
  { key: 'aiCreation', table: 'ai_creation_images', sizeExpr: 'file_size', extraWhere: '' },
  {
    key: 'subsite',
    table: 'subsite_uploads',
    sizeExpr: 'COALESCE(actual_bytes, declared_bytes)',
    extraWhere: "status = 'settled'",
  },
  {
    key: 'shoppingList',
    table: 'shopping_list_image_uploads',
    sizeExpr: 'COALESCE(actual_bytes, declared_bytes)',
    extraWhere: "status = 'confirmed'",
  },
]

/** 探测线上已存在的来源表，缺表的来源自动跳过 */
async function detectSourceTables(db) {
  const res = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${DAY_SOURCES.map(() => '?').join(',')})`,
    )
    .bind(...DAY_SOURCES.map((s) => s.table))
    .all()
  return new Set((res.results || []).map((r) => r.name))
}

/** 单个来源的当日切片 SELECT（extraWhere 与日期条件合并） */
const daySelect = (s, cmp) =>
  `SELECT uid, '${s.key}' AS src, ${s.sizeExpr} AS bytes, created_at FROM ${s.table}
     WHERE ${s.extraWhere ? `${s.extraWhere} AND ` : ''}date(created_at, '+8 hours') ${cmp} ?`

/** 当日按用户聚合行（含四来源拆解列），供分页列表复用；SUM(CASE) 对缺席来源自然得 0 */
const perUserSql = `
  SELECT a.*, u.email, u.username, u.avatar, u.is_admin
  FROM (
    SELECT uid, COUNT(*) AS files, COALESCE(SUM(bytes), 0) AS total, MAX(created_at) AS last_at,
           SUM(CASE WHEN src = 'music' THEN 1 ELSE 0 END) AS music_c,
           SUM(CASE WHEN src = 'music' THEN bytes ELSE 0 END) AS music_b,
           SUM(CASE WHEN src = 'aiCreation' THEN 1 ELSE 0 END) AS ai_c,
           SUM(CASE WHEN src = 'aiCreation' THEN bytes ELSE 0 END) AS ai_b,
           SUM(CASE WHEN src = 'subsite' THEN 1 ELSE 0 END) AS sub_c,
           SUM(CASE WHEN src = 'subsite' THEN bytes ELSE 0 END) AS sub_b,
           SUM(CASE WHEN src = 'shoppingList' THEN 1 ELSE 0 END) AS shop_c,
           SUM(CASE WHEN src = 'shoppingList' THEN bytes ELSE 0 END) AS shop_b
    FROM day_usage GROUP BY uid
  ) a
  LEFT JOIN user u ON u.id = a.uid`

const SOURCE_COLS = [
  { key: 'music', countCol: 'music_c', bytesCol: 'music_b' },
  { key: 'aiCreation', countCol: 'ai_c', bytesCol: 'ai_b' },
  { key: 'subsite', countCol: 'sub_c', bytesCol: 'sub_b' },
  { key: 'shoppingList', countCol: 'shop_c', bytesCol: 'shop_b' },
]

const emptySources = () => ({
  music: { count: 0, bytes: 0 },
  aiCreation: { count: 0, bytes: 0 },
  subsite: { count: 0, bytes: 0 },
  shoppingList: { count: 0, bytes: 0 },
})

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const url = new URL(request.url)
  const dateParam = (url.searchParams.get('date') || '').trim()
  if (dateParam && !DATE_RE.test(dateParam)) {
    return jsonError('date 参数格式应为 YYYY-MM-DD', 400)
  }
  const date = dateParam || utc8Today()
  const uid = (url.searchParams.get('uid') || '').trim()

  try {
    const existing = await detectSourceTables(db)
    const active = DAY_SOURCES.filter((s) => existing.has(s.table))
    const missingTables = DAY_SOURCES.filter((s) => !existing.has(s.table)).map((s) => s.table)

    // ============ 带 uid：该用户当天的逐文件记录（缺表来源返回空） ============
    if (uid) {
      const items = [
        {
          kind: 'user',
          stmt: db.prepare('SELECT email, username, avatar, is_admin FROM user WHERE id = ?').bind(uid),
        },
      ]
      if (existing.has('music_songs')) {
        items.push({
          kind: 'music',
          stmt: db
            .prepare(
              `SELECT title AS name, file_size AS bytes, created_at FROM music_songs
               WHERE uid = ? AND date(created_at, '+8 hours') = ? ORDER BY created_at DESC`,
            )
            .bind(uid, date),
        })
      }
      if (existing.has('ai_creation_images')) {
        items.push({
          kind: 'ai',
          stmt: db
            .prepare(
              `SELECT COALESCE(NULLIF(filename, ''), NULLIF(prompt, ''), '图片') AS name,
                      file_size AS bytes, created_at
               FROM ai_creation_images
               WHERE uid = ? AND date(created_at, '+8 hours') = ? ORDER BY created_at DESC`,
            )
            .bind(uid, date),
        })
      }
      if (existing.has('shopping_list_image_uploads')) {
        items.push({
          kind: 'shopping',
          stmt: db
            .prepare(
              `SELECT r2_key, COALESCE(actual_bytes, declared_bytes) AS bytes, created_at
               FROM shopping_list_image_uploads
               WHERE uid = ? AND status = 'confirmed' AND date(created_at, '+8 hours') = ?
               ORDER BY created_at DESC`,
            )
            .bind(uid, date),
        })
      }
      if (existing.has('subsite_uploads')) {
        items.push({
          kind: 'subsite',
          stmt: db
            .prepare(
              `SELECT s.id, s.client_id, c.name AS client_name, s.object_key, s.content_type,
                      s.declared_bytes, s.actual_bytes, s.status, s.created_at, s.settled_at
               FROM subsite_uploads s
               LEFT JOIN oauth_clients c ON c.client_id = s.client_id
               WHERE s.uid = ? AND date(s.created_at, '+8 hours') = ?
               ORDER BY s.created_at DESC`,
            )
            .bind(uid, date),
        })
      }

      const results = await db.batch(items.map((i) => i.stmt))
      const rowsByKind = {}
      items.forEach((item, i) => {
        rowsByKind[item.kind] = results[i]?.results || []
      })

      const user = rowsByKind.user[0]
      // 三类落库文件合并成一张逐文件表（子站上传单独返回，带结算状态）
      const files = [
        ...(rowsByKind.music || []).map((r) => ({
          type: 'music',
          name: r.name || '-',
          bytes: intOr0(r.bytes),
          createdAt: r.created_at,
        })),
        ...(rowsByKind.ai || []).map((r) => ({
          type: 'ai_creation',
          name: r.name || '-',
          bytes: intOr0(r.bytes),
          createdAt: r.created_at,
        })),
        ...(rowsByKind.shopping || []).map((r) => ({
          type: 'shopping_list',
          name: String(r.r2_key || '').split('/').pop() || r.r2_key,
          bytes: intOr0(r.bytes),
          createdAt: r.created_at,
        })),
      ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

      const uploads = (rowsByKind.subsite || []).map((u) => ({
        id: u.id,
        clientId: u.client_id,
        clientName: u.client_name || null,
        filename: String(u.object_key || '').split('/').pop() || u.object_key,
        contentType: u.content_type || '',
        declaredBytes: intOr0(u.declared_bytes),
        actualBytes: u.actual_bytes == null ? null : intOr0(u.actual_bytes),
        status: u.status || 'pending',
        createdAt: u.created_at,
        settledAt: u.settled_at || null,
      }))

      // 子站汇总口径与列表模式一致（仅 settled 实扣），uploads 明细则含各状态便于观察队列
      const settledUploads = uploads.filter((u) => u.status === 'settled')
      const subsiteSettledBytes = settledUploads.reduce(
        (s, u) => s + (u.actualBytes ?? u.declaredBytes ?? 0),
        0,
      )

      const sumRows = (rows) => ({
        count: (rows || []).length,
        bytes: (rows || []).reduce((s, r) => s + intOr0(r.bytes), 0),
      })

      const summary = {
        totalBytes: files.reduce((sum, f) => sum + f.bytes, 0) + subsiteSettledBytes,
        totalFiles: files.length + settledUploads.length,
        sources: {
          music: sumRows(rowsByKind.music),
          aiCreation: sumRows(rowsByKind.ai),
          shoppingList: sumRows(rowsByKind.shopping),
          subsite: { count: settledUploads.length, bytes: subsiteSettledBytes },
        },
      }

      return json({
        date,
        user: {
          uid,
          email: user?.email || null,
          username: user?.username || null,
          avatar: user?.avatar || null,
          isAdmin: !!user?.is_admin,
        },
        summary,
        files,
        uploads,
        missingTables,
      })
    }

    // ============ 不带 uid：当日汇总 + 趋势 + 按用户分页列表 ============
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize'), 10) || 20))
    const keyword = (url.searchParams.get('keyword') || '').trim()
    const trendDays = Math.min(90, Math.max(7, parseInt(url.searchParams.get('trendDays'), 10) || 30))
    const offset = (page - 1) * pageSize

    const trendStart = utc8DaysAgo(trendDays - 1)
    const trendEnd = utc8Today()

    // 一个来源表都没有（极端情况）：返回全零 + 空列表，不再触发 SQL
    if (active.length === 0) {
      return json({
        date,
        summary: { date, totalBytes: 0, totalFiles: 0, users: 0, sources: emptySources() },
        trend: fillTrend([], trendStart, trendEnd),
        list: [],
        pagination: { total: 0, page, pageSize, totalPages: 1, hasNext: false, hasPrev: false },
        missingTables,
      })
    }

    const dayUsageSql = `WITH day_usage AS (${active.map((s) => daySelect(s, '=')).join(' UNION ALL ')})`
    const dateBinds = active.map(() => date)
    const trendSql = `SELECT d, COUNT(*) AS f, COUNT(DISTINCT uid) AS u, COALESCE(SUM(s), 0) AS b FROM (
      ${active.map((s) => `SELECT uid, date(created_at, '+8 hours') AS d, ${s.sizeExpr} AS s FROM ${s.table}
         WHERE ${s.extraWhere ? `${s.extraWhere} AND ` : ''}date(created_at, '+8 hours') >= ?`).join(' UNION ALL ')}
    ) GROUP BY d ORDER BY d`
    const trendBinds = active.map(() => trendStart)

    const like = likeContains(keyword)
    const keywordWhere = keyword
      ? 'WHERE (u.email LIKE ? OR u.username LIKE ? OR a.uid LIKE ?)'
      : ''
    const keywordBinds = keyword ? [like, like, like] : []

    const [totalRow, perSourceRes, countRes, listRes, trendRes] = await db.batch([
      db.prepare(
        `${dayUsageSql} SELECT COUNT(DISTINCT uid) AS users, COUNT(*) AS files, COALESCE(SUM(bytes), 0) AS total FROM day_usage`,
      ).bind(...dateBinds),
      db.prepare(
        `${dayUsageSql} SELECT src, COUNT(*) AS c, COALESCE(SUM(bytes), 0) AS s FROM day_usage GROUP BY src`,
      ).bind(...dateBinds),
      db.prepare(
        `SELECT COUNT(*) AS c FROM (
           ${dayUsageSql} SELECT uid FROM day_usage GROUP BY uid
         ) a LEFT JOIN user u ON u.id = a.uid ${keywordWhere}`,
      ).bind(...dateBinds, ...keywordBinds),
      db.prepare(
        `${dayUsageSql} ${perUserSql} ${keywordWhere} ORDER BY a.total DESC, a.uid LIMIT ? OFFSET ?`,
      ).bind(...dateBinds, ...keywordBinds, pageSize, offset),
      db.prepare(trendSql).bind(...trendBinds),
    ])

    const sources = emptySources()
    for (const r of perSourceRes.results || []) {
      if (sources[r.src]) sources[r.src] = { count: intOr0(r.c), bytes: intOr0(r.s) }
    }

    const list = (listRes.results || []).map((r) => ({
      uid: r.uid,
      email: r.email || null,
      username: r.username || null,
      avatar: r.avatar || null,
      isAdmin: !!r.is_admin,
      totalBytes: intOr0(r.total),
      totalFiles: intOr0(r.files),
      lastAt: r.last_at || null,
      sources: Object.fromEntries(
        SOURCE_COLS.map((s) => [s.key, { count: intOr0(r[s.countCol]), bytes: intOr0(r[s.bytesCol]) }]),
      ),
    }))

    const trend = fillTrend(
      (trendRes.results || []).map((r) => ({
        date: r.d,
        bytes: intOr0(r.b),
        files: intOr0(r.f),
        users: intOr0(r.u),
      })),
      trendStart,
      trendEnd,
    )

    const total = intOr0(countRes?.results?.[0]?.c)
    return json({
      date,
      summary: {
        date,
        totalBytes: intOr0(totalRow?.results?.[0]?.total),
        totalFiles: intOr0(totalRow?.results?.[0]?.files),
        users: intOr0(totalRow?.results?.[0]?.users),
        sources,
      },
      trend,
      list,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1,
      },
      missingTables,
    })
  } catch (error) {
    console.error('[admin/storage/daily] error:', error)
    return jsonError(error.message || '服务器错误')
  }
}
