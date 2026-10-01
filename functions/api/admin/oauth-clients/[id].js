// Admin OAuth 客户端单条
// PUT    /api/admin/oauth-clients/:id  body: { name?, description?, logo_url?, redirect_uris?, is_disabled? }
// DELETE /api/admin/oauth-clients/:id  （同时清理授权记录并撤销所有令牌）
// 鉴权已在 api/admin/_middleware.js 完成
import { normalizeRedirectUris, sanitizeText } from '../../_lib/oauth-client-utils.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
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

  const id = context.params?.id
  if (!id) return jsonError('缺少 id')

  const existing = await db.prepare(`SELECT client_id FROM oauth_clients WHERE client_id = ?`).bind(id).first()
  if (!existing) return jsonError('应用不存在', 404)

  try {
    if (request.method === 'DELETE') {
      await db.batch([
        db.prepare(`DELETE FROM oauth_clients WHERE client_id = ?`).bind(id),
        db.prepare(`DELETE FROM oauth_user_consents WHERE client_id = ?`).bind(id),
        db.prepare(`UPDATE oauth_access_tokens SET revoked = 1 WHERE client_id = ?`).bind(id),
        db.prepare(`UPDATE oauth_refresh_tokens SET revoked = 1 WHERE client_id = ?`).bind(id),
        db.prepare(`DELETE FROM oauth_authorization_codes WHERE client_id = ?`).bind(id),
      ])
      return json({ client_id: id, deleted: true })
    }

    if (request.method !== 'PUT') return jsonError('不支持的请求方法', 405)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON')

    const sets = [`updated_at = datetime('now')`]
    const args = []

    if (body.name !== undefined) {
      const name = sanitizeText(body.name, 40)
      if (!name) return jsonError('应用名称不能为空')
      sets.push('name = ?')
      args.push(name)
    }
    if (body.description !== undefined) {
      sets.push('description = ?')
      args.push(sanitizeText(body.description, 200))
    }
    if (body.logo_url !== undefined) {
      sets.push('logo_url = ?')
      args.push(sanitizeText(body.logo_url, 500))
    }
    if (body.redirect_uris !== undefined) {
      const uris = normalizeRedirectUris(body.redirect_uris)
      if (uris.error) return jsonError(uris.error)
      sets.push('redirect_uris = ?')
      args.push(uris.value)
    }
    if (body.is_disabled !== undefined) {
      sets.push('is_disabled = ?')
      args.push(body.is_disabled ? 1 : 0)
      // 停用即时生效：撤销该应用所有令牌
      if (body.is_disabled) {
        await db.prepare(`UPDATE oauth_access_tokens SET revoked = 1 WHERE client_id = ?`).bind(id).run()
        await db.prepare(`UPDATE oauth_refresh_tokens SET revoked = 1 WHERE client_id = ?`).bind(id).run()
      }
    }

    if (sets.length === 1) return jsonError('没有可更新的字段')

    args.push(id)
    await db.prepare(`UPDATE oauth_clients SET ${sets.join(', ')} WHERE client_id = ?`).bind(...args).run()

    const row = await db
      .prepare(
        `SELECT client_id, name, description, logo_url, redirect_uris, is_disabled, created_at, updated_at
         FROM oauth_clients WHERE client_id = ?`,
      )
      .bind(id)
      .first()
    return json(row)
  } catch (error) {
    console.error('admin oauth-client item error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
