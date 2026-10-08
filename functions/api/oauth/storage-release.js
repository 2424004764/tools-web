// OAuth2 释放上传预留端点（放弃/失败上传时调用）
// POST /api/oauth/storage-release   Authorization: Bearer <access_token>（scope: storage）
//   Body: { reservation_id }
//   主动释放预留，pending_bytes 立即回落；幂等，预留超时自动失效。
import { oauthJson, oauthError, openCorsPreflight, lookupAccessToken, isTokenUsable, tokenHasScope } from './_lib.js'
import { releaseReservation } from '../../services/storageQuotaService.js'

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
    const reservationId = typeof body?.reservation_id === 'string' ? body.reservation_id.trim() : ''
    if (!reservationId) return oauthError('invalid_request', '缺少 reservation_id', 400)

    const released = await releaseReservation(db, user.id, reservationId)
    return oauthJson({ ok: true, released })
  } catch (error) {
    console.error('[oauth/storage-release] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}
