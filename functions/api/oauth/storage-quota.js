// OAuth2 存储额度端点
// GET /api/oauth/storage-quota   Authorization: Bearer <access_token>（或 ?access_token=）
// 返回用户可上传存储空间额度（scope: storage）
import { oauthJson, oauthError, openCorsPreflight, lookupAccessToken, isTokenUsable, tokenHasScope } from './_lib.js'
import { getStorageQuota } from '../../services/storageQuotaService.js'
import { STORAGE_BYTES_PER_CREDIT } from '../../config/storage.js'

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
    if (!tokenHasScope(tokenRow, 'storage')) {
      return oauthError('insufficient_scope', '该 access_token 未被授予 storage scope，请引导用户重新授权', 403)
    }

    const user = await db.prepare(`SELECT id FROM user WHERE id = ?`).bind(tokenRow.user_id).first()
    if (!user) return oauthError('invalid_token', '用户不存在', 401)

    const quota = await getStorageQuota(db, user.id)

    return oauthJson({
      sub: user.id,
      quota_bytes: quota.quotaBytes,
      used_bytes: quota.usedBytes,
      pending_bytes: quota.pendingBytes,
      remaining_bytes: quota.remainingBytes,
      price: {
        credits: 1,
        bytes: STORAGE_BYTES_PER_CREDIT,
      },
    })
  } catch (error) {
    console.error('[oauth/storage-quota] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}
