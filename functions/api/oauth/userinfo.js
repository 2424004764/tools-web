// OAuth2 用户信息端点
// GET /api/oauth/userinfo   Authorization: Bearer <access_token>（或 ?access_token=）
// 返回主站账号资料（scope: profile）
import { oauthJson, oauthError, openCorsPreflight, lookupAccessToken, isTokenUsable, tokenHasScope } from './_lib.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return openCorsPreflight()
  if (request.method !== 'GET') return oauthError('invalid_request', '仅支持 GET', 405)

  const db = env.DB
  if (!db) return oauthError('server_error', '数据库未配置', 500)

  try {
    const authHeader = request.headers.get('Authorization') || ''
    const url = new URL(request.url)
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (url.searchParams.get('access_token') || '').trim()

    if (!token) return oauthError('invalid_token', '缺少 access_token', 401)

    const tokenRow = await lookupAccessToken(db, token)
    if (!tokenRow || !isTokenUsable(tokenRow)) {
      return oauthError('invalid_token', 'access_token 无效或已过期', 401)
    }
    if (!tokenHasScope(tokenRow, 'profile')) {
      return oauthError('insufficient_scope', '该 access_token 未被授予 profile scope', 403)
    }

    const user = await db
      .prepare(`SELECT id, username, email, avatar, created_at FROM user WHERE id = ?`)
      .bind(tokenRow.user_id)
      .first()
    if (!user) return oauthError('invalid_token', '用户不存在', 401)

    return oauthJson({
      sub: user.id, // OpenID 风格的唯一标识
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      created_at: user.created_at,
    })
  } catch (error) {
    console.error('[oauth/userinfo] error:', error)
    // 不回显 error.message（可能携带内部细节），统一对外文案
    return oauthError('server_error', '服务器错误', 500)
  }
}
