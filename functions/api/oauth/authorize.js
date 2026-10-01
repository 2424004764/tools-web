// OAuth2 授权端点（配合前端 SPA 页面 /oauth/authorize 使用）
// GET  /api/oauth/authorize?client_id=&redirect_uri=&state=&scope=
//      校验参数与登录态：未登录返回 need_login；已登录且此前授权过 → 直接发授权码（SSO 静默）；否则 need_consent
// POST /api/oauth/authorize  body: { client_id, redirect_uri, state, scope, deny }
//      需要主站 JWT；记录用户授权（consent）并签发授权码，返回最终跳转地址
import { AuthMiddleware } from '../../middlewares/auth.js'
import {
  oauthJson,
  oauthError,
  loadActiveClient,
  validateRedirectUri,
  normalizeScope,
  createAuthorizationCode,
  formatNow,
  SUPPORTED_SCOPES,
} from './_lib.js'

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

export const SCOPE_DESCRIPTIONS = {
  profile: '读取你的账号资料（用户名、邮箱、头像）',
}

// 把 code/state 拼到回调地址上（兼容已有 query 和 hash）
function buildRedirectTo(redirectUri, params) {
  const [base, hash] = redirectUri.split('#')
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}${qs}${hash ? '#' + hash : ''}`
}

async function loadDisabledUser(db, userId) {
  const row = await db.prepare(`SELECT is_disabled FROM user WHERE id = ?`).bind(userId).first()
  return Boolean(row?.is_disabled)
}

async function getGrantedScope(db, userId, clientId) {
  const row = await db
    .prepare(`SELECT scope FROM oauth_user_consents WHERE user_id = ? AND client_id = ?`)
    .bind(userId, clientId)
    .first()
  return row ? String(row.scope || '').split(' ').filter(Boolean) : []
}

// 公共校验：返回 { client, scope } 或 { error: Response }
async function validateRequest(db, urlParams) {
  const clientId = String(urlParams.get('client_id') || '').trim()
  const redirectUri = String(urlParams.get('redirect_uri') || '').trim()
  const state = String(urlParams.get('state') || '')
  const responseType = String(urlParams.get('response_type') || 'code')

  if (!clientId || !redirectUri) {
    return { error: jsonError('缺少 client_id 或 redirect_uri', 400) }
  }
  if (responseType !== 'code') {
    return { error: jsonError('不支持的 response_type，仅支持 code', 400) }
  }

  const client = await loadActiveClient(db, clientId)
  if (!client) {
    return { error: jsonError('无效或已停用的 client_id', 400) }
  }
  if (!validateRedirectUri(client, redirectUri)) {
    return { error: jsonError('redirect_uri 不在该应用的白名单内', 400) }
  }

  const scope = normalizeScope(urlParams.get('scope'))
  if (!scope) {
    return { error: jsonError(`不支持的 scope，仅支持：${SUPPORTED_SCOPES.join(' ')}`, 400) }
  }

  return { client, redirectUri, state, scope }
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  const url = new URL(request.url)

  try {
    if (request.method === 'GET') {
      const checked = await validateRequest(db, url.searchParams)
      if (checked.error) return checked.error
      const { client, redirectUri, state, scope } = checked

      // 读取主站登录态（无效/过期 token 按未登录处理）
      const auth = await AuthMiddleware.extractUserFromRequestOptional(request, env)
      let user = auth.user
      if (user && (await loadDisabledUser(db, user.id))) user = null

      if (!user) {
        return json({
          client: pickClient(client),
          redirect_uri: redirectUri,
          state,
          scope,
          scope_descriptions: SCOPE_DESCRIPTIONS,
          user: null,
          need_login: true,
          need_consent: false,
        })
      }

      // 已登录：检查历史授权，scope 未扩大则静默发码（SSO）
      const granted = await getGrantedScope(db, user.id, client.client_id)
      const requested = scope.split(' ')
      const fullyGranted = requested.every((s) => granted.includes(s))

      if (fullyGranted) {
        const code = await createAuthorizationCode(db, {
          clientId: client.client_id,
          userId: user.id,
          redirectUri,
          scope,
        })
        return json({
          client: pickClient(client),
          redirect_uri: redirectUri,
          state,
          scope,
          scope_descriptions: SCOPE_DESCRIPTIONS,
          user,
          need_login: false,
          need_consent: false,
          code,
          redirect_to: buildRedirectTo(redirectUri, { code, state }),
        })
      }

      return json({
        client: pickClient(client),
        redirect_uri: redirectUri,
        state,
        scope,
        scope_descriptions: SCOPE_DESCRIPTIONS,
        user,
        need_login: false,
        need_consent: true,
      })
    }

    if (request.method === 'POST') {
      // 授权确认必须携带主站 JWT
      const auth = await AuthMiddleware.extractUserFromRequest(request, env)
      if (!auth.success) return jsonError(auth.error || '请先登录', 401)
      const user = auth.user
      if (await loadDisabledUser(db, user.id)) return jsonError('账号已被禁用', 403)

      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

      const params = new URLSearchParams()
      for (const key of ['client_id', 'redirect_uri', 'state', 'scope']) {
        if (body[key] !== undefined) params.set(key, String(body[key]))
      }
      const checked = await validateRequest(db, params)
      if (checked.error) return checked.error
      const { client, redirectUri, state, scope } = checked

      // 拒绝授权：按 RFC 6749 回传 access_denied
      if (body.deny) {
        return json({
          redirect_to: buildRedirectTo(redirectUri, { error: 'access_denied', error_description: '用户拒绝了授权', state }),
        })
      }

      // 记录授权（scope 覆盖为本次授权的最大集合）
      const granted = new Set(await getGrantedScope(db, user.id, client.client_id))
      scope.split(' ').forEach((s) => granted.add(s))
      const mergedScope = [...granted].join(' ')

      await db
        .prepare(
          `INSERT INTO oauth_user_consents (user_id, client_id, scope, granted_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (user_id, client_id) DO UPDATE SET scope = excluded.scope, granted_at = excluded.granted_at`,
        )
        .bind(user.id, client.client_id, mergedScope, formatNow())
        .run()

      const code = await createAuthorizationCode(db, {
        clientId: client.client_id,
        userId: user.id,
        redirectUri,
        scope,
      })

      return json({
        code,
        state,
        redirect_to: buildRedirectTo(redirectUri, { code, state }),
      })
    }

    return jsonError('不支持的请求方法', 405)
  } catch (error) {
    console.error('[oauth/authorize] error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}

function pickClient(client) {
  return {
    client_id: client.client_id,
    name: client.name,
    description: client.description,
    logo_url: client.logo_url,
  }
}
