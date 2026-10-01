// OAuth2 令牌撤销端点（RFC 7009 风格）
// POST /api/oauth/revoke   token=<access_token|refresh_token>&client_id=&client_secret=
// 无论 token 是否有效都返回 200（不向调用方泄露 token 有效性）
import { oauthJson, oauthError, openCorsPreflight, sha256Hex, loadActiveClient, verifyClientSecret, extractClientCredentials } from './_lib.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return openCorsPreflight()
  if (request.method !== 'POST') return oauthError('invalid_request', '仅支持 POST', 405)

  const db = env.DB
  if (!db) return oauthError('server_error', '数据库未配置', 500)

  try {
    const form = await request.formData().catch(() => null)
    if (!form) return oauthError('invalid_request', '请求体格式错误')
    const params = new URLSearchParams()
    for (const [k, v] of form.entries()) params.set(k, String(v))

    const { clientId, clientSecret } = extractClientCredentials(request, params)
    const token = (params.get('token') || '').trim()
    if (!token || !clientId) return oauthError('invalid_request', '缺少 token 或 client_id')

    const client = await loadActiveClient(db, clientId)
    if (!client) return oauthError('invalid_client', '无效或已停用的 client_id', 401)
    const secretOk = await verifyClientSecret(db, env, client, clientSecret)
    if (!clientSecret || !secretOk) return oauthError('invalid_client', 'client_secret 错误', 401)

    const tokenHash = await sha256Hex(token)
    // access / refresh 两张表都尝试撤销（仅限本客户端的令牌）
    await db
      .prepare(`UPDATE oauth_access_tokens SET revoked = 1 WHERE token_hash = ? AND client_id = ?`)
      .bind(tokenHash, clientId)
      .run()
    await db
      .prepare(`UPDATE oauth_refresh_tokens SET revoked = 1 WHERE token_hash = ? AND client_id = ?`)
      .bind(tokenHash, clientId)
      .run()

    return oauthJson({ revoked: true })
  } catch (error) {
    console.error('[oauth/revoke] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}
