// OAuth2 存储额度预留端点（上传签名前调用）
// POST /api/oauth/storage-reserve   Authorization: Bearer <access_token>（scope: storage）
//   Body: { bytes }
//   原子预扣剩余额度并返回 reservation_id；PUT 完成后由 storage-settle 结算，
//   放弃上传由 storage-release 释放；预留超过 TTL 自动失效，不会永久占坑。
//   剩余额度不足回 402（quota_exceeded），与 storage-quota 的价格字段约定一致。
import { oauthJson, oauthError, openCorsPreflight, lookupAccessToken, isTokenUsable, tokenHasScope } from './_lib.js'
import { reserveStorage, getStorageQuota } from '../../services/storageQuotaService.js'

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

    const reservationId = await reserveStorage(db, user.id, bytes)
    if (!reservationId) {
      const quota = await getStorageQuota(db, user.id)
      return oauthJson(
        {
          error: 'quota_exceeded',
          error_description: '剩余存储额度不足',
          remaining_bytes: quota.remainingBytes,
          need_bytes: bytes,
        },
        402,
      )
    }
    return oauthJson({ ok: true, reservation_id: reservationId })
  } catch (error) {
    console.error('[oauth/storage-reserve] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}
