// OAuth2 存储额度结算端点（R2 PUT 成功后调用）
// POST /api/oauth/storage-settle   Authorization: Bearer <access_token>（scope: storage）
//   Body: { bytes, reservation_id? }
//   按 bytes 累加 used_bytes 并删除预留；对象真实大小由调用方子站
//   以 R2 HEAD 为准校验后上报（工具站无法跨桶 HEAD 子站的桶）。
//   reservation_id 缺省（预留流程未启用）时退化为直接累加。
import { oauthJson, oauthError, openCorsPreflight, lookupAccessToken, isTokenUsable, tokenHasScope } from './_lib.js'
import { settleReservation, commitStorageUsage } from '../../services/storageQuotaService.js'

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
    const reservationId = typeof body?.reservation_id === 'string' && body.reservation_id.trim() ? body.reservation_id.trim() : null

    if (reservationId) {
      await settleReservation(db, user.id, reservationId, bytes)
    } else {
      await commitStorageUsage(db, user.id, bytes)
    }
    return oauthJson({ ok: true })
  } catch (error) {
    console.error('[oauth/storage-settle] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}
