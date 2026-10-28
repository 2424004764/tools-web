// 购物清单图片删除（删 R2 对象 + 退回存储额度）
//   POST /api/shopping-lists/images/delete
//     Body: { url } 或 { r2Key }
//     校验对象属于当前用户命名空间 → HEAD 拿真实大小 → DELETE R2 → 退回额度
//     对象已不存在（404）→ 不退额度（防止重复调用刷额度）
//     Resp: { ok: true, deleted: boolean, refunded: number }

import { extractUidFromRequest } from '../../_lib/model-resolver.js'
import { deleteR2Object, headR2ObjectSize } from '../../../services/r2.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

/** 公网 URL 或裸 key → r2 key；不属于当前用户命名空间返回 null */
function resolveR2Key(env, body, uid) {
  const prefix = `shopping-list/${uid}/`
  if (body?.r2Key) {
    const key = String(body.r2Key).trim()
    return key.startsWith(prefix) ? key : null
  }
  const url = String(body?.url || '').trim()
  if (!url) return null
  try {
    const u = new URL(url)
    let key = u.pathname.replace(/^\/+/, '')
    try {
      key = decodeURIComponent(key)
    } catch { /* 保持原样 */ }
    return key.startsWith(prefix) ? key : null
  } catch {
    return null
  }
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return jsonError('请先登录', 401)

  try {
    const body = await request.json().catch(() => ({}))
    const r2Key = resolveR2Key(env, body, uid)
    if (!r2Key) return jsonError('图片地址不合法或不属于当前用户', 403)

    const lockToken = crypto.randomUUID()
    const upload = await db
      .prepare(
        `UPDATE shopping_list_image_uploads
         SET status = 'deleting', lock_token = ?, updated_at = datetime('now')
         WHERE r2_key = ? AND uid = ? AND status = 'confirmed' AND lock_token IS NULL`,
      )
      .bind(lockToken, r2Key, uid)
      .run()
    if ((upload?.meta?.changes ?? 0) !== 1) {
      const bucket = env.R2_BUCKET_NAME
      const row = await db
        .prepare('SELECT status FROM shopping_list_image_uploads WHERE r2_key = ? AND uid = ?')
        .bind(r2Key, uid)
        .first()
      if (row) return json({ deleted: false, refunded: 0, alreadyDeleted: row.status === 'deleted' })
      if (!bucket) return jsonError('R2 桶名未配置', 500)
      const size = await headR2ObjectSize(env, bucket, r2Key)
      if (size === null) return json({ deleted: false, refunded: 0 })
      await deleteR2Object(env, bucket, r2Key)
      return json({ deleted: true, refunded: 0, legacy: true })
    }

    const bucket = env.R2_BUCKET_NAME
    if (!bucket) {
      await db.prepare("UPDATE shopping_list_image_uploads SET status = 'confirmed', lock_token = NULL WHERE r2_key = ? AND uid = ? AND lock_token = ?").bind(r2Key, uid, lockToken).run()
      return jsonError('R2 桶名未配置', 500)
    }

    let size
    try {
      size = await headR2ObjectSize(env, bucket, r2Key)
      if (size === null) {
        await db.prepare("UPDATE shopping_list_image_uploads SET status = 'deleted', lock_token = NULL WHERE r2_key = ? AND uid = ? AND lock_token = ?").bind(r2Key, uid, lockToken).run()
        return json({ deleted: false, refunded: 0 })
      }
      await deleteR2Object(env, bucket, r2Key)
    } catch (error) {
      await db.prepare("UPDATE shopping_list_image_uploads SET status = 'confirmed', lock_token = NULL WHERE r2_key = ? AND uid = ? AND lock_token = ?").bind(r2Key, uid, lockToken).run()
      throw error
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const results = await db.batch([
      db.prepare(
        `UPDATE user_storage_quota SET used_bytes = MAX(0, used_bytes - ?), updated_at = ?
         WHERE uid = ? AND EXISTS (
           SELECT 1 FROM shopping_list_image_uploads
           WHERE r2_key = ? AND uid = ? AND status = 'deleting' AND lock_token = ?
         )`,
      ).bind(size, now, uid, r2Key, uid, lockToken),
      db.prepare(
        `UPDATE shopping_list_image_uploads SET status = 'deleted', lock_token = NULL, updated_at = ?
         WHERE r2_key = ? AND uid = ? AND status = 'deleting' AND lock_token = ?`,
      ).bind(now, r2Key, uid, lockToken),
    ])
    if ((results?.[1]?.meta?.changes ?? 0) !== 1) return jsonError('退款结算失败，请联系管理员', 500)
    return json({ deleted: true, refunded: size })
  } catch (error) {
    console.error('Shopping list image delete error:', error)
    return jsonError('图片删除失败，请稍后重试', 500)
  }
}
