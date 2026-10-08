// OAuth2 存储额度退还端点（删除对象后调用）
// POST /api/oauth/storage-refund   Authorization: Bearer <access_token>（scope: storage）
//   Body: { bytes }
//   按 bytes 退回 used_bytes（封顶 0，防负数）。对象真实大小与「确实已删除」
//   由调用方子站保证：先 R2 HEAD 拿大小再删，404（对象不存在）不发起退还，
//   因此重复调用同一删除不会反复刷额度。
import { oauthJson, oauthError, openCorsPreflight, lookupAccessToken, isTokenUsable, tokenHasScope } from './_lib.js'
import { refundStorageUsage } from '../../services/storageQuotaService.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return openCorsPreflight()
  if (request.method !== 'POST') return oauthError('invalid_request', '仅支持 POST', 405)

  const db = env.DB
  if (!db) return oauthError('server_error', '数据库未配置', 500)

  try {
    const authHeader = request.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return oauthError('invalid_token', '缺少 access_token', 401)

    const tokenRow = await lookupAccessToken(db, token)
    if (!tokenRow || !isTokenUsable(tokenRow)) {
      return oauthError('invalid_token', 'access_token 无效或已过期', 401)
    }
    if (!tokenHasScope(tokenRow, 'storage')) {
      return oauthError('insufficient_scope', '该 access_token 未被授予 storage scope，请引导用户重新授权', 403)
    }
    const user = await db.prepare(`SELECT id FROM user WHERE id = ?`).bind(tokenRow.user_id).first()
    if (!user) return oauthError('invalid_token', '用户不存在', 401)

    const body = await request.json().catch(() => null)
    const bytes = Math.floor(Number(body?.bytes))
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return oauthError('invalid_request', 'bytes 需为正整数', 400)
    }

    await refundStorageUsage(db, user.id, bytes)
    return oauthJson({ ok: true })
  } catch (error) {
    console.error('[oauth/storage-refund] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}
