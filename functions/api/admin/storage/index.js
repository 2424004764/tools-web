// Admin 存储空间使用明细 API（列表 + 全站汇总）
// GET /api/admin/storage    query: page, pageSize, keyword
//
// 返回：
//   summary  全站总额度 / 已用 / 预留中 / 可用 + 各来源占用（音乐 / AI 创作图 / 子站上传）
//   list     按用户聚合的用量行（默认按已用降序），每行带来源拆解
//
// 口径说明（与 storageQuotaService 一致）：
//   剩余 = quota_bytes - used_bytes - 未过期预留(storage_reservations)
//   来源拆解来自各业务表（music_songs / ai_creation_images / subsite_uploads settled），
//   与 used_bytes 的差额记为 other（生成图持久化、购物清单图片等未逐文件归集的部分）。
//
// 鉴权：/api/admin/_middleware.js 已校验管理员，这里无需重复检查。

import { STORAGE_RESERVATION_TTL_SECONDS } from '../../../config/storage.js'

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

/** 按 uid 集合批量聚合一个来源表（sql 需含 :placeholders）：返回 Map<uid, { count, bytes }> */
async function aggregateSource(db, sql, uids) {
  const placeholders = uids.map(() => '?').join(',')
  const res = await db
    .prepare(sql.replace(':placeholders', placeholders))
    .bind(...uids)
    .all()
  const map = new Map()
  for (const r of res.results || []) {
    map.set(r.uid, { count: intOr0(r.c), bytes: intOr0(r.s) })
  }
  return map
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize'), 10) || 20))
    const keyword = (url.searchParams.get('keyword') || '').trim()
    const offset = (page - 1) * pageSize

    // ============ 全站汇总 ============
    // 额度行即「用过存储的用户」，未产生过上传的用户没有行
    const [quotaRow, pendingRow, musicRow, aiRow, subsiteRow] = await db.batch([
      db.prepare(
        `SELECT COALESCE(SUM(quota_bytes), 0) AS quota, COALESCE(SUM(used_bytes), 0) AS used, COUNT(*) AS users
         FROM user_storage_quota`,
      ),
      db.prepare(
        `SELECT COALESCE(SUM(bytes), 0) AS pending FROM storage_reservations
         WHERE created_at >= datetime('now', ?)`,
      ).bind(`-${STORAGE_RESERVATION_TTL_SECONDS} seconds`),
      db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS s FROM music_songs`),
      db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS s FROM ai_creation_images`),
      db.prepare(
        `SELECT COUNT(*) AS c, COALESCE(SUM(COALESCE(actual_bytes, declared_bytes)), 0) AS s
         FROM subsite_uploads WHERE status = 'settled'`,
      ),
    ])
    const quotaTotal = intOr0(quotaRow?.results?.[0]?.quota)
    const usedTotal = intOr0(quotaRow?.results?.[0]?.used)
    const pendingTotal = intOr0(pendingRow?.results?.[0]?.pending)

    const summary = {
      quotaBytes: quotaTotal,
      usedBytes: usedTotal,
      pendingBytes: pendingTotal,
      availableBytes: Math.max(0, quotaTotal - usedTotal - pendingTotal),
      users: intOr0(quotaRow?.results?.[0]?.users),
      sources: {
        music: { count: intOr0(musicRow?.results?.[0]?.c), bytes: intOr0(musicRow?.results?.[0]?.s) },
        aiCreation: { count: intOr0(aiRow?.results?.[0]?.c), bytes: intOr0(aiRow?.results?.[0]?.s) },
        subsite: { count: intOr0(subsiteRow?.results?.[0]?.c), bytes: intOr0(subsiteRow?.results?.[0]?.s) },
      },
    }

    // ============ 用户用量列表（分页 / 搜索，按已用降序） ============
    const whereSql = keyword ? 'WHERE (u.email LIKE ? OR u.username LIKE ? OR q.uid LIKE ?)' : ''
    const like = `%${keyword}%`

    const countRow = keyword
      ? await db
          .prepare(
            `SELECT COUNT(*) AS c FROM user_storage_quota q LEFT JOIN user u ON u.id = q.uid ${whereSql}`,
          )
          .bind(like, like, like)
          .first()
      : await db.prepare('SELECT COUNT(*) AS c FROM user_storage_quota').first()
    const total = intOr0(countRow?.c)

    const listResult = await db
      .prepare(
        `SELECT q.uid, q.quota_bytes, q.used_bytes, q.updated_at,
                u.email, u.username, u.avatar, u.is_admin
         FROM user_storage_quota q
         LEFT JOIN user u ON u.id = q.uid
         ${whereSql}
         ORDER BY q.used_bytes DESC, q.uid
         LIMIT ? OFFSET ?`,
      )
      .bind(...(keyword ? [like, like, like] : []), pageSize, offset)
      .all()

    const rows = listResult.results || []

    // 当前页用户的来源拆解（一次 IN 聚合，避免逐行子查询）
    let musicMap = new Map()
    let aiMap = new Map()
    let subsiteMap = new Map()
    let pendingMap = new Map()
    if (rows.length > 0) {
      const uids = rows.map((r) => r.uid)
      ;[musicMap, aiMap, subsiteMap, pendingMap] = await Promise.all([
        aggregateSource(
          db,
          `SELECT uid, COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS s FROM music_songs WHERE uid IN (:placeholders) GROUP BY uid`,
          uids,
        ),
        aggregateSource(
          db,
          `SELECT uid, COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS s FROM ai_creation_images WHERE uid IN (:placeholders) GROUP BY uid`,
          uids,
        ),
        aggregateSource(
          db,
          `SELECT uid, COUNT(*) AS c, COALESCE(SUM(COALESCE(actual_bytes, declared_bytes)), 0) AS s
           FROM subsite_uploads WHERE uid IN (:placeholders) AND status = 'settled' GROUP BY uid`,
          uids,
        ),
        // 有效上传预留（未过期）：>0 且长期不消说明结算链路异常
        aggregateSource(
          db,
          `SELECT uid, COUNT(*) AS c, COALESCE(SUM(bytes), 0) AS s FROM storage_reservations
           WHERE uid IN (:placeholders) AND created_at >= datetime('now', '-${STORAGE_RESERVATION_TTL_SECONDS} seconds')
           GROUP BY uid`,
          uids,
        ),
      ])
    }

    const list = rows.map((r) => {
      const quotaBytes = intOr0(r.quota_bytes)
      const usedBytes = intOr0(r.used_bytes)
      const music = musicMap.get(r.uid) || { count: 0, bytes: 0 }
      const aiCreation = aiMap.get(r.uid) || { count: 0, bytes: 0 }
      const subsite = subsiteMap.get(r.uid) || { count: 0, bytes: 0 }
      const pending = pendingMap.get(r.uid) || { count: 0, bytes: 0 }
      const identified = music.bytes + aiCreation.bytes + subsite.bytes
      return {
        uid: r.uid,
        email: r.email || null,
        username: r.username || null,
        avatar: r.avatar || null,
        isAdmin: !!r.is_admin,
        quotaBytes,
        usedBytes,
        pendingBytes: pending.bytes,
        pendingCount: pending.count,
        availableBytes: Math.max(0, quotaBytes - usedBytes - pending.bytes),
        updatedAt: r.updated_at || null,
        sources: {
          music,
          aiCreation,
          subsite,
          // 已用减去可归集来源：生成图持久化、购物清单图片、历史漂移等
          other: { count: 0, bytes: Math.max(0, usedBytes - identified) },
        },
      }
    })

    return json({
      summary,
      list,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('[admin/storage] error:', error)
    return jsonError(error.message || '服务器错误')
  }
}
