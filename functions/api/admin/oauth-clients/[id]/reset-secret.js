// Admin 重置 OAuth 客户端密钥
// POST /api/admin/oauth-clients/:id/reset-secret
// 新密钥仅在本次响应中返回一次；重置后撤销该应用所有令牌（子站需更新密钥）
import { encryptSecret } from '../../../../utils/crypto-secret.js'
import { randomHex } from '../../../_lib/oauth-client-utils.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  const id = context.params?.id
  if (!id) return jsonError('缺少 id')

  const existing = await db.prepare(`SELECT client_id FROM oauth_clients WHERE client_id = ?`).bind(id).first()
  if (!existing) return jsonError('应用不存在', 404)

  try {
    const clientSecret = 'tcs_' + randomHex(24)
    await db.batch([
      db
        .prepare(`UPDATE oauth_clients SET client_secret = ?, updated_at = datetime('now') WHERE client_id = ?`)
        .bind(await encryptSecret(clientSecret, env.JWT_SECRET), id),
      db.prepare(`UPDATE oauth_access_tokens SET revoked = 1 WHERE client_id = ?`).bind(id),
      db.prepare(`UPDATE oauth_refresh_tokens SET revoked = 1 WHERE client_id = ?`).bind(id),
    ])

    return json({ client_id: id, client_secret: clientSecret })
  } catch (error) {
    console.error('admin oauth-client reset-secret error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
