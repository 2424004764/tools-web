// OAuth2 存储额度退还端点（子站删除对象后调用）
// POST /api/oauth/storage-refund   Authorization: Bearer <access_token>（scope: storage）
//   Body: { object_key }（推荐：子站删 R2 对象时本来就要用的那个 key，无需额外存储）
//         或 { upload_id }（凭证响应里返回的 id，效果相同）
//
// 2026-10 安全修正：旧契约接受自报 { bytes }，而 storage scope 用户本人就能通过
// 授权流程拿到，等于持 token 者可无限次把 used_bytes 清零（无限白嫖存储）。
// 现改为只信服务端记账：
//   - 退还金额取自 subsite_uploads 该次上传实扣的字节数
//     （worker 按 R2 事件回填的 actual_bytes，缺省回落 declared_bytes）
//   - 以 settled → refunded 的原子状态流转保证每次上传只能退一次，
//     并发重复退款时第二个 UPDATE 命中 0 行直接 404，天然幂等
//   - 行必须同时属于该用户与该子站（client_id），杜绝跨用户/跨子站退账
// 注意：走已废弃的自报结算（storage-settle.js）落账的对象没有 settled 行，无法退还。
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
    // 兼容两种入参：凭证下发时返回的 upload_id，或完整对象 key（取第三段）
    let uploadId = typeof body?.upload_id === 'string' ? body.upload_id.trim() : ''
    if (!uploadId && typeof body?.object_key === 'string') {
      const segs = body.object_key.split('/').filter(Boolean)
      if (segs[0] === 'subsite') uploadId = segs[2] || ''
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(uploadId)) {
      return oauthError('invalid_request', '需提供 object_key（或 upload_id），退还金额以服务端记账为准', 400)
    }

    // 原子认领：只有「属于该用户 + 该子站 + 已实扣(settled)」的行能翻成 refunded
    const claim = await db
      .prepare(
        `UPDATE subsite_uploads
           SET status = 'refunded'
         WHERE id = ? AND uid = ? AND client_id = ? AND status = 'settled'`,
      )
      .bind(uploadId, user.id, tokenRow.client_id)
      .run()
    if ((claim?.meta?.changes ?? claim?.changes ?? 0) === 0) {
      // 区分失败原因，子站据此决定重试还是放弃：
      //   refunded → 重复删除，幂等成功；pending → 队列尚未结算，稍后重试；
      //   无行/其他状态 → 无可退额度（旧自报结算时代的对象或未完成的悬空预留）
      const row = await db
        .prepare(`SELECT status FROM subsite_uploads WHERE id = ? AND uid = ? AND client_id = ?`)
        .bind(uploadId, user.id, tokenRow.client_id)
        .first()
      if (!row) {
        return oauthError('invalid_request', '上传记录不存在或不属于当前用户/子站', 404)
      }
      if (row.status === 'refunded') {
        return oauthJson({ ok: true, refunded_bytes: 0, already: true })
      }
      if (row.status === 'pending') {
        return oauthError('not_settled_yet', '主站队列尚未结算该上传，请稍后重试（建议 30s 后，最多重试数次）', 409)
      }
      return oauthError('invalid_request', '该上传未计入存储额度（rejected/expired），无需退还', 404)
    }

    // 退还金额只取服务端记账：worker 实扣回填的 actual_bytes（缺省回落到凭证声明值）
    const row = await db
      .prepare(`SELECT COALESCE(actual_bytes, declared_bytes) AS bytes FROM subsite_uploads WHERE id = ?`)
      .bind(uploadId)
      .first()
    const bytes = Math.max(0, Math.floor(Number(row?.bytes) || 0))
    if (bytes > 0) {
      await refundStorageUsage(db, user.id, bytes)
    }
    return oauthJson({ ok: true, refunded_bytes: bytes })
  } catch (error) {
    console.error('[oauth/storage-refund] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}
