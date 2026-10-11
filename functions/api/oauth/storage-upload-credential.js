// OAuth2 子站上传凭证下发端点（统一入口，凭证 = R2 预签名 PUT URL）
// POST /api/oauth/storage-upload-credential   Authorization: Bearer <access_token>（scope: storage）
//   Body: { filename, bytes, content_type? }
//   流程：
//     1. 校验 access_token 有效且具备 storage scope（token 天然携带 client_id = 子站身份）
//     2. 校验子站未停用且已在后台登记 r2_bucket（未登记 = 未开通上传）
//     3. 原子预扣用户剩余额度（storage_reservations，不足回 402）
//     4. 写 subsite_uploads 记录（upload_id 为队列事件回溯主键）
//     5. 签发预签名 PUT URL：content-length 与 content-type 都锁进签名，
//        上传时大小/类型不符 → R2 直接 403 拒绝，对象不会写入
//   实扣：子站桶的 PutObject 事件通知 → Cloudflare Queue → tools-web-worker
//         按 upload_id 幂等结算（used_bytes += declared_bytes、释放预占、status=settled）。
//         storage-settle 自报端点已废弃，勿再调用。
import { oauthJson, oauthError, openCorsPreflight, lookupAccessToken, isTokenUsable, tokenHasScope, loadActiveClient } from './_lib.js'
import { reserveStorage, releaseReservation, getStorageQuota } from '../../services/storageQuotaService.js'
import { signR2PutUrl } from '../../services/r2.js'
import { SUBSITE_UPLOAD_MAX_BYTES } from '../../config/storage.js'

const PRESIGN_EXPIRES_IN = 900 // 与 services/r2.js 的预签名有效期一致（15 分钟）

// 文件名只取最后一段路径，去掉控制字符，限制长度；保留中文等 unicode
function sanitizeFilename(raw) {
  const base = String(raw || '')
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  if (!base) return 'file'
  return base.length > 120 ? base.slice(0, 120) : base
}

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

    const client = await loadActiveClient(db, tokenRow.client_id)
    if (!client) return oauthError('invalid_client', '应用不存在或已停用', 403)
    const bucket = String(client.r2_bucket || '').trim()
    if (!bucket) {
      return oauthError('upload_not_enabled', '该子站未登记 R2 桶，未开通上传服务，请联系主站管理员', 403)
    }

    const user = await db.prepare(`SELECT id FROM user WHERE id = ?`).bind(tokenRow.user_id).first()
    if (!user) return oauthError('invalid_token', '用户不存在', 401)

    const body = await request.json().catch(() => null)
    const bytes = Math.floor(Number(body?.bytes))
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return oauthError('invalid_request', 'bytes（文件字节数）必传且需为正整数', 400)
    }
    if (bytes > SUBSITE_UPLOAD_MAX_BYTES) {
      return oauthError('invalid_request', `单文件最大 ${Math.floor(SUBSITE_UPLOAD_MAX_BYTES / 1024 / 1024)}MB`, 400)
    }
    const contentType = String(body?.content_type || '').trim() || 'application/octet-stream'
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) {
      return oauthError('invalid_request', 'content_type 格式不合法（如 image/png）', 400)
    }
    const filename = sanitizeFilename(body?.filename)

    // 原子预扣：额度不足直接拒发凭证（附余额明细，子站可直接提示还差多少）
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

    const uploadId = crypto.randomUUID()
    const objectKey = `subsite/${user.id}/${uploadId}/${filename}`
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    let presign
    try {
      await db
        .prepare(
          `INSERT INTO subsite_uploads
             (id, uid, client_id, bucket, object_key, declared_bytes, content_type, reservation_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        )
        .bind(uploadId, user.id, client.client_id, bucket, objectKey, bytes, contentType, reservationId, now)
        .run()
      presign = await signR2PutUrl(env, bucket, objectKey, contentType, { contentLength: bytes })
    } catch (error) {
      // 回滚：释放预扣 + 删除记录，不留悬空预留
      await releaseReservation(db, user.id, reservationId).catch(() => {})
      await db.prepare(`DELETE FROM subsite_uploads WHERE id = ?`).bind(uploadId).run().catch(() => {})
      throw error
    }

    return oauthJson({
      ok: true,
      upload_id: uploadId,
      upload_url: presign.uploadUrl,
      bucket,
      object_key: objectKey,
      bytes,
      content_type: contentType,
      expires_at: new Date(presign.expiresAt).toISOString(),
      expires_in: PRESIGN_EXPIRES_IN,
      // 提示子站：URL 已锁定长度与类型，实扣由主站队列异步完成，无需（也不要）再调 settle
      notice: 'Content-Length 与 Content-Type 已锁定，不符将直接 403；上传成功后由主站队列自动实扣，无需上报 settle',
    })
  } catch (error) {
    console.error('[oauth/storage-upload-credential] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}
