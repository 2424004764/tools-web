// OAuth2 授权服务器共享工具
// 被 authorize / token / userinfo / revoke 端点共用
import { decryptSecret } from '../../utils/crypto-secret.js'

// ---------- CORS ----------
// 协议端点（token/userinfo/revoke）可能被任意子站的前端直接调用，
// 因此对任意 Origin 反射放行；authorize 依赖主站登录态，走主站白名单逻辑由端点自行处理。
const OPEN_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export function openCorsPreflight() {
  return new Response(null, { status: 204, headers: OPEN_CORS })
}

export function oauthJson(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...OPEN_CORS, ...headers },
  })
}

// RFC 6749 错误响应
export function oauthError(error, description, status = 400, headers = {}) {
  return oauthJson({ error, error_description: description }, status, headers)
}

// ---------- 随机数 / 哈希 ----------
export function randomHex(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function formatNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

// ---------- scope ----------
export const SUPPORTED_SCOPES = ['profile', 'storage']

export function normalizeScope(raw) {
  const requested = String(raw || '').split(/[\s+,]/).filter(Boolean)
  const scopes = requested.length ? requested : ['profile']
  if (scopes.some((s) => !SUPPORTED_SCOPES.includes(s))) return null
  return [...new Set(scopes)].join(' ')
}

// ---------- 客户端 ----------
export function validateRedirectUri(client, redirectUri) {
  if (!redirectUri) return false
  const allowed = String(client.redirect_uris || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  // 精确匹配，不做前缀/通配
  return allowed.includes(redirectUri)
}

export async function loadActiveClient(db, clientId) {
  if (!clientId) return null
  const row = await db
    .prepare(`SELECT client_id, client_secret, name, description, logo_url, redirect_uris, is_disabled
              FROM oauth_clients WHERE client_id = ?`)
    .bind(clientId)
    .first()
  if (!row || row.is_disabled) return null
  return row
}

export async function verifyClientSecret(db, env, client, secret) {
  try {
    const plain = await decryptSecret(client.client_secret, env.JWT_SECRET)
    return plain && plain === secret
  } catch {
    return false
  }
}

// 从 form body / Basic auth 中解析 client_id + client_secret
export function extractClientCredentials(request, params) {
  let clientId = params.get('client_id') || ''
  let clientSecret = params.get('client_secret') || ''
  const authHeader = request.headers.get('Authorization') || ''
  if (authHeader.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice(6))
      const idx = decoded.indexOf(':')
      if (idx > -1) {
        clientId = decoded.slice(0, idx)
        clientSecret = decoded.slice(idx + 1)
      }
    } catch {
      // ignore malformed basic header
    }
  }
  return { clientId, clientSecret }
}

// ---------- 授权码 ----------
const CODE_TTL = 10 * 60 // 10 分钟

export async function createAuthorizationCode(db, { clientId, userId, redirectUri, scope }) {
  const code = 'oac_' + randomHex(32)
  await db
    .prepare(
      `INSERT INTO oauth_authorization_codes
        (code_hash, client_id, user_id, redirect_uri, scope, expires_at, used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(
      await sha256Hex(code),
      clientId,
      userId,
      redirectUri,
      scope,
      Math.floor(Date.now() / 1000) + CODE_TTL,
      formatNow(),
    )
    .run()
  return code
}

// ---------- 令牌签发 ----------
const ACCESS_TOKEN_TTL = 2 * 60 * 60 // 2 小时
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 // 30 天

export async function issueTokenPair(db, { clientId, userId, scope }) {
  const accessToken = 'oat_' + randomHex(32)
  const refreshToken = 'ort_' + randomHex(32)
  const now = formatNow()

  await db
    .prepare(
      `INSERT INTO oauth_access_tokens (token_hash, client_id, user_id, scope, expires_at, revoked, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(await sha256Hex(accessToken), clientId, userId, scope, Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL, now)
    .run()

  await db
    .prepare(
      `INSERT INTO oauth_refresh_tokens (token_hash, client_id, user_id, scope, expires_at, revoked, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(await sha256Hex(refreshToken), clientId, userId, scope, Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL, now)
    .run()

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refreshToken,
    scope,
  }
}

export async function lookupAccessToken(db, token) {
  if (!token) return null
  return db
    .prepare(
      `SELECT t.token_hash, t.client_id, t.user_id, t.scope, t.expires_at, t.revoked,
              c.is_disabled AS client_disabled
       FROM oauth_access_tokens t
       LEFT JOIN oauth_clients c ON c.client_id = t.client_id
       WHERE t.token_hash = ?`,
    )
    .bind(await sha256Hex(token))
    .first()
}

export function isTokenUsable(row) {
  return Boolean(row && !row.revoked && row.expires_at > Math.floor(Date.now() / 1000) && !row.client_disabled)
}

// access_token 是否被授予了某个 scope
export function tokenHasScope(row, scope) {
  return Boolean(row && String(row.scope || '').split(' ').includes(scope))
}
