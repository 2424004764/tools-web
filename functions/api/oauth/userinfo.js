// OAuth2 用户信息端点
// GET /api/oauth/userinfo   Authorization: Bearer <access_token>（或 ?access_token=）
// 返回主站账号资料 + 积分余额（scope: profile）；无积分行时余额按 0 返回
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

    // LEFT JOIN 积分表：无积分行的用户余额按 0 返回（与 /api/me/credits 策略一致）
    const user = await db
      .prepare(
        `SELECT u.id, u.username, u.email, u.avatar, u.created_at,
                COALESCE(c.balance, 0) AS credits_balance,
                COALESCE(c.total_earned, 0) AS credits_earned,
                COALESCE(c.total_spent, 0) AS credits_spent
         FROM user u
         LEFT JOIN user_credits c ON c.uid = u.id
         WHERE u.id = ?`,
      )
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
      credits: {
        balance: user.credits_balance, // 当前可用积分
        total_earned: user.credits_earned, // 累计获得
        total_spent: user.credits_spent, // 累计消耗
      },
    })
  } catch (error) {
    console.error('[oauth/userinfo] error:', error)
    // 不回显 error.message（可能携带内部细节），统一对外文案
    return oauthError('server_error', '服务器错误', 500)
  }
}
