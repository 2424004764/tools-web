// Admin 单用户存储使用明细 API
// GET /api/admin/storage/detail?uid=xxx
//
// 返回：
//   user      基本信息快照（邮箱 / 用户名 / 头像）
//   quota     额度概况（总额度 / 已用 / 预留中 / 可用 / 更新时间）
//   sources   来源拆解（音乐 / AI 创作图 / 子站上传 / 其他）
//   files     最近文件（音乐 + AI 创作图合并，按创建时间倒序取 20 条）
//   uploads   最近子站上传记录（含队列结算状态，倒序取 20 条）
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

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = (new URL(request.url).searchParams.get('uid') || '').trim()
  if (!uid) return jsonError('缺少 uid 参数', 400)

  try {
    // ============ 额度概况 + 用户快照 + 预留 ============
    const [quotaRow, userRow, pendingRow, musicRow, aiRow, subsiteRow] = await db.batch([
      db.prepare('SELECT quota_bytes, used_bytes, updated_at FROM user_storage_quota WHERE uid = ?').bind(uid),
      db.prepare('SELECT email, username, avatar, is_admin FROM user WHERE id = ?').bind(uid),
      db
        .prepare(
          `SELECT COALESCE(SUM(bytes), 0) AS pending FROM storage_reservations
           WHERE uid = ? AND created_at >= datetime('now', ?)`,
        )
        .bind(uid, `-${STORAGE_RESERVATION_TTL_SECONDS} seconds`),
      db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS s FROM music_songs WHERE uid = ?').bind(uid),
      db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS s FROM ai_creation_images WHERE uid = ?').bind(uid),
      db
        .prepare(
          `SELECT COUNT(*) AS c, COALESCE(SUM(COALESCE(actual_bytes, declared_bytes)), 0) AS s
           FROM subsite_uploads WHERE uid = ? AND status = 'settled'`,
        )
        .bind(uid),
    ])

    const quotaBytes = intOr0(quotaRow?.results?.[0]?.quota_bytes)
    const usedBytes = intOr0(quotaRow?.results?.[0]?.used_bytes)
    const pendingBytes = intOr0(pendingRow?.results?.[0]?.pending)
    const music = { count: intOr0(musicRow?.results?.[0]?.c), bytes: intOr0(musicRow?.results?.[0]?.s) }
    const aiCreation = { count: intOr0(aiRow?.results?.[0]?.c), bytes: intOr0(aiRow?.results?.[0]?.s) }
    const subsite = { count: intOr0(subsiteRow?.results?.[0]?.c), bytes: intOr0(subsiteRow?.results?.[0]?.s) }
    const identified = music.bytes + aiCreation.bytes + subsite.bytes

    // ============ 最近文件（音乐 + AI 创作图合并倒序） ============
    const filesResult = await db
      .prepare(
        `SELECT * FROM (
           SELECT 'music' AS type, title AS name, file_size AS bytes, created_at
           FROM music_songs WHERE uid = ?
           UNION ALL
           SELECT 'ai_creation' AS type,
                  COALESCE(NULLIF(filename, ''), NULLIF(prompt, ''), 'image') AS name,
                  file_size AS bytes, created_at
           FROM ai_creation_images WHERE uid = ?
         )
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .bind(uid, uid)
      .all()

    // ============ 最近子站上传记录（带应用名，观察队列结算状态） ============
    const uploadsResult = await db
      .prepare(
        `SELECT s.id, s.client_id, c.name AS client_name, s.object_key, s.content_type,
                s.declared_bytes, s.actual_bytes, s.status, s.created_at, s.settled_at
         FROM subsite_uploads s
         LEFT JOIN oauth_clients c ON c.client_id = s.client_id
         WHERE s.uid = ?
         ORDER BY s.created_at DESC
         LIMIT 20`,
      )
      .bind(uid)
      .all()

    // ============ 有效预留清单（观察卡单：哪笔预扣迟迟未结算） ============
    const reservationsResult = await db
      .prepare(
        `SELECT id, bytes, created_at FROM storage_reservations
         WHERE uid = ? AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .bind(uid, `-${STORAGE_RESERVATION_TTL_SECONDS} seconds`)
      .all()

    const user = userRow?.results?.[0]
    return json({
      user: {
        uid,
        email: user?.email || null,
        username: user?.username || null,
        avatar: user?.avatar || null,
        isAdmin: !!user?.is_admin,
      },
      quota: {
        quotaBytes,
        usedBytes,
        pendingBytes,
        availableBytes: Math.max(0, quotaBytes - usedBytes - pendingBytes),
        updatedAt: quotaRow?.results?.[0]?.updated_at || null,
        // 无额度行 = 该用户从未产生过存储上传
        exists: !!quotaRow?.results?.[0],
      },
      sources: {
        music,
        aiCreation,
        subsite,
        // 已用减去可归集来源：生成图持久化（generated-images）、购物清单图片、历史漂移等
        other: { count: 0, bytes: Math.max(0, usedBytes - identified) },
      },
      // 有效预留明细（>0 且长期不消说明结算链路异常，可在前端一键清理）
      reservations: (reservationsResult.results || []).map((r) => ({
        id: r.id,
        bytes: intOr0(r.bytes),
        createdAt: r.created_at,
      })),
      files: (filesResult.results || []).map((f) => ({
        type: f.type,
        name: f.name || '-',
        bytes: intOr0(f.bytes),
        createdAt: f.created_at,
      })),
      uploads: (uploadsResult.results || []).map((u) => ({
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
      })),
    })
  } catch (error) {
    console.error('[admin/storage/detail] error:', error)
    return jsonError(error.message || '服务器错误')
  }
}
