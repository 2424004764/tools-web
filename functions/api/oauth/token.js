// OAuth2 令牌端点
// POST /api/oauth/token   Content-Type: application/x-www-form-urlencoded（也接受 JSON）
//   grant_type=authorization_code: code, redirect_uri, client_id, client_secret
//   grant_type=refresh_token:      refresh_token, client_id, client_secret
// 客户端凭据也支持 HTTP Basic（Authorization: Basic base64(client_id:client_secret)）
import {
  oauthJson,
  oauthError,
  openCorsPreflight,
  sha256Hex,
  loadActiveClient,
  verifyClientSecret,
  extractClientCredentials,
  issueTokenPair,
} from './_lib.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return openCorsPreflight()
  if (request.method !== 'POST') return oauthError('invalid_request', '仅支持 POST', 405)

  const db = env.DB
  if (!db) return oauthError('server_error', '数据库未配置', 500)

  try {
    const contentType = request.headers.get('Content-Type') || ''
    let params
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}))
      params = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v ?? '')]))
    } else {
      const form = await request.formData().catch(() => null)
      if (!form) return oauthError('invalid_request', '请求体格式错误')
      params = new URLSearchParams()
      for (const [k, v] of form.entries()) params.set(k, String(v))
    }

    const grantType = params.get('grant_type')
    const { clientId, clientSecret } = extractClientCredentials(request, params)

    if (!clientId) return oauthError('invalid_client', '缺少 client_id', 401)
    const client = await loadActiveClient(db, clientId)
    if (!client) return oauthError('invalid_client', '无效或已停用的 client_id', 401)

    if (grantType === 'authorization_code') {
      return await handleAuthorizationCode(db, env, client, { clientSecret, params })
    }
    if (grantType === 'refresh_token') {
      return await handleRefreshToken(db, env, client, { clientSecret, params })
    }
    return oauthError('unsupported_grant_type', '不支持的 grant_type，仅支持 authorization_code / refresh_token')
  } catch (error) {
    console.error('[oauth/token] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}

async function handleAuthorizationCode(db, env, client, { clientSecret, params }) {
  const code = (params.get('code') || '').trim()
  const redirectUri = (params.get('redirect_uri') || '').trim()

  if (!code) return oauthError('invalid_request', '缺少 code')
  const codeHash = await sha256Hex(code)

  const row = await db.prepare(`SELECT * FROM oauth_authorization_codes WHERE code_hash = ?`).bind(codeHash).first()
  if (!row) return oauthError('invalid_grant', '授权码无效')
  if (row.client_id !== client.client_id) return oauthError('invalid_grant', '授权码与客户端不匹配')

  const nowSec = Math.floor(Date.now() / 1000)
  if (row.expires_at < nowSec) return oauthError('invalid_grant', '授权码已过期')

  if (redirectUri !== row.redirect_uri) {
    return oauthError('invalid_grant', 'redirect_uri 与授权请求不一致')
  }

  // 客户端认证：必须在消费授权码之前完成，认证失败不消费，避免合法 code 被无关请求烧掉
  if (!clientSecret) return oauthError('invalid_client', '缺少 client_secret', 401)
  const secretOk = await verifyClientSecret(db, env, client, clientSecret)
  if (!secretOk) return oauthError('invalid_client', 'client_secret 错误', 401)

  // 一次性消费：原子更新，防止并发重放
  const consume = await db
    .prepare(`UPDATE oauth_authorization_codes SET used = 1 WHERE code_hash = ? AND used = 0`)
    .bind(codeHash)
    .run()
  const consumed = consume?.meta?.changes === 1
  if (!consumed) {
    // 授权码重放：撤销该授权码此前签发的所有令牌（RFC 6749 4.1.2 建议）
    await db
      .prepare(
        `UPDATE oauth_access_tokens SET revoked = 1 WHERE client_id = ? AND user_id = ? AND created_at >= (SELECT created_at FROM oauth_authorization_codes WHERE code_hash = ?)`,
      )
      .bind(row.client_id, row.user_id, codeHash)
      .run()
    await db
      .prepare(
        `UPDATE oauth_refresh_tokens SET revoked = 1 WHERE client_id = ? AND user_id = ? AND created_at >= (SELECT created_at FROM oauth_authorization_codes WHERE code_hash = ?)`,
      )
      .bind(row.client_id, row.user_id, codeHash)
      .run()
    return oauthError('invalid_grant', '授权码已被使用')
  }

  const tokens = await issueTokenPair(db, {
    clientId: client.client_id,
    userId: row.user_id,
    scope: row.scope,
  })
  return oauthJson(tokens)
}

async function handleRefreshToken(db, env, client, { clientSecret, params }) {
  const refreshToken = (params.get('refresh_token') || '').trim()
  if (!refreshToken) return oauthError('invalid_request', '缺少 refresh_token')

  const secretOk = await verifyClientSecret(db, env, client, clientSecret)
  if (!clientSecret || !secretOk) return oauthError('invalid_client', 'client_secret 错误', 401)

  const tokenHash = await sha256Hex(refreshToken)
  const row = await db
    .prepare(`SELECT * FROM oauth_refresh_tokens WHERE token_hash = ?`)
    .bind(tokenHash)
    .first()
  if (!row) return oauthError('invalid_grant', 'refresh_token 无效')
  if (row.client_id !== client.client_id) return oauthError('invalid_grant', 'refresh_token 与客户端不匹配')
  if (row.revoked) return oauthError('invalid_grant', 'refresh_token 已被撤销')
  if (row.expires_at < Math.floor(Date.now() / 1000)) return oauthError('invalid_grant', 'refresh_token 已过期')

  // 轮换：旧 refresh_token 作废，签发新的一对
  await db.prepare(`UPDATE oauth_refresh_tokens SET revoked = 1 WHERE token_hash = ?`).bind(tokenHash).run()

  const tokens = await issueTokenPair(db, {
    clientId: client.client_id,
    userId: row.user_id,
    scope: row.scope,
  })
  return oauthJson(tokens)
}
