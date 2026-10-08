// Admin IP 封禁规则管理
//   GET  /api/admin/ip-bans   列出全部生效中的封禁（顺带清理已过期行）
//   POST /api/admin/ip-bans   新增封禁 body: { ip, reason?, duration_hours? }
// 鉴权：目录中间件 _middleware.js 已保证 admin（context.data.adminUid）
//
// 封禁键规则：IPv4 存完整地址；IPv6 统一按 /64 网段封禁（normalizeBanKey）。
// 中间件侧有 ~15s 的 isolate 缓存，封禁/解封最迟 15 秒生效。

import { normalizeBanKey } from '../../../utils/ip-ban.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// 最长封 1 年；0 = 永久
const MAX_DURATION_HOURS = 24 * 365

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
  const { request, env, data } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    if (request.method === 'GET') {
      // 清理过期行，让列表始终只含生效中的规则
      await db
        .prepare(`DELETE FROM ip_bans WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')`)
        .run()
      const rows = await db
        .prepare(
          `SELECT id, ip, original_ip, reason, banned_by, banned_by_email, created_at, expires_at
           FROM ip_bans ORDER BY created_at DESC`,
        )
        .all()
      return json({ list: rows.results || [] })
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

      const original = String(body.ip || '').trim()
      const key = normalizeBanKey(original)
      if (!key) return jsonError('IP 格式不正确（支持 IPv4 / IPv6，IPv6 按 /64 网段封禁）', 400)

      const reason = String(body.reason || '').trim().slice(0, 100)
      const hours = Number(body.duration_hours) || 0
      if (!Number.isInteger(hours) || hours < 0 || hours > MAX_DURATION_HOURS) {
        return jsonError('封禁时长不合法', 400)
      }

      const adminUid = data?.adminUid || null
      let adminEmail = ''
      if (adminUid) {
        const u = await db.prepare(`SELECT email FROM user WHERE id = ?`).bind(adminUid).first()
        adminEmail = u?.email || ''
      }

      // 重复封同一键时覆盖原因/时长/操作人；hours 已验证为安全整数，可内联进 SQL
      const expiresExpr = hours > 0 ? `datetime('now', '+${hours} hours')` : 'NULL'
      await db
        .prepare(
          `INSERT INTO ip_bans (id, ip, original_ip, reason, banned_by, banned_by_email, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ${expiresExpr})
           ON CONFLICT(ip) DO UPDATE SET
             original_ip = excluded.original_ip,
             reason = excluded.reason,
             banned_by = excluded.banned_by,
             banned_by_email = excluded.banned_by_email,
             expires_at = excluded.expires_at,
             created_at = datetime('now')`,
        )
        .bind(crypto.randomUUID(), key, original, reason, adminUid, adminEmail)
        .run()

      // ON CONFLICT 命中时插入的 id 不生效，按封禁键回查真实行
      const rule = await db
        .prepare(
          `SELECT id, ip, original_ip, reason, banned_by, banned_by_email, created_at, expires_at
           FROM ip_bans WHERE ip = ?`,
        )
        .bind(key)
        .first()
      return json({ rule })
    }

    return jsonError('不支持的请求方法', 405)
  } catch (err) {
    console.error('[admin/ip-bans] error:', err)
    return jsonError(err.message || '服务器错误', 500)
  }
}
