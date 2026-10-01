// Admin OAuth 客户端列表 / 创建
// GET  /api/admin/oauth-clients?page=&pageSize=&keyword=
// POST /api/admin/oauth-clients  body: { name, description?, logo_url?, redirect_uris }
// 鉴权已在 api/admin/_middleware.js 完成
import { encryptSecret } from '../../../utils/crypto-secret.js'
import { sanitizeText, normalizeRedirectUris, randomHex } from '../../_lib/oauth-client-utils.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
      const keyword = (url.searchParams.get('keyword') || '').trim()
      const offset = (page - 1) * pageSize

      const where = []
      const args = []
      if (keyword) {
        where.push('(name LIKE ? OR client_id LIKE ?)')
        const like = `%${keyword}%`
        args.push(like, like)
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const totalRow = await db.prepare(`SELECT COUNT(*) AS c FROM oauth_clients ${whereSql}`).bind(...args).first()
      const total = totalRow?.c || 0

      const list = await db
        .prepare(
          `SELECT c.client_id, c.name, c.description, c.logo_url, c.redirect_uris, c.is_disabled,
                  c.created_at, c.updated_at,
                  (SELECT COUNT(*) FROM oauth_user_consents k WHERE k.client_id = c.client_id) AS granted_users
           FROM oauth_clients c ${whereSql}
           ORDER BY c.created_at DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(...args, pageSize, offset)
        .all()

      return json({
        list: list.results || [],
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      })
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON')

      const name = sanitizeText(body.name, 40)
      if (!name) return jsonError('应用名称不能为空')

      const uris = normalizeRedirectUris(body.redirect_uris)
      if (uris.error) return jsonError(uris.error)

      const clientId = 'tc_' + randomHex(8)
      const clientSecret = 'tcs_' + randomHex(24)
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

      await db
        .prepare(
          `INSERT INTO oauth_clients (client_id, client_secret, name, description, logo_url, redirect_uris, is_disabled, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        )
        .bind(
          clientId,
          await encryptSecret(clientSecret, env.JWT_SECRET),
          name,
          sanitizeText(body.description, 200),
          sanitizeText(body.logo_url, 500),
          uris.value,
          context.data?.adminUid || null,
          now,
          now,
        )
        .run()

      // secret 仅在创建/重置时返回一次，之后只存密文
      return json({ client_id: clientId, client_secret: clientSecret, name })
    }

    return jsonError('不支持的请求方法', 405)
  } catch (error) {
    console.error('admin oauth-clients error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
