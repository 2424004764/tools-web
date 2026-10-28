// 购物清单图片上传确认（R2 PUT 成功后调用）
//   POST /api/shopping-lists/images/confirm
//     Body: { r2Key, reservationId? }
//     校验 r2Key 属于当前用户命名空间 → HEAD R2 拿真实大小 → 结算用量 + 释放预留
//     Resp: { ok: true, size }

import { extractUidFromRequest } from '../../_lib/model-resolver.js'
import { headR2ObjectSize } from '../../../services/r2.js'
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
    const r2Key = String(body?.r2Key || '').trim()
    const reservationId = body?.reservationId ? String(body.reservationId).trim() : ''
    if (!reservationId) return jsonError('缺少存储预留标识', 400)
    if (!r2Key.startsWith(`shopping-list/${uid}/`)) {
      return jsonError('r2Key 不在当前用户命名空间内', 403)
    }

    const lockToken = crypto.randomUUID()
    const upload = await db
      .prepare(
        `UPDATE shopping_list_image_uploads
         SET status = 'confirming', lock_token = ?, updated_at = datetime('now')
         WHERE r2_key = ? AND uid = ? AND reservation_id = ? AND status = 'pending'
           AND EXISTS (SELECT 1 FROM storage_reservations WHERE id = ? AND uid = ?)`
      )
      .bind(lockToken, r2Key, uid, reservationId, reservationId, uid)
      .run()
    if ((upload?.meta?.changes ?? 0) !== 1) {
      const existing = await db
        .prepare('SELECT status, actual_bytes FROM shopping_list_image_uploads WHERE r2_key = ? AND uid = ?')
        .bind(r2Key, uid)
        .first()
      if (existing?.status === 'confirmed') return json({ size: existing.actual_bytes, already: true })
      return jsonError('上传预留不存在、已消费或不匹配', 409)
    }

    const bucket = env.R2_BUCKET_NAME
    if (!bucket) {
      await db.prepare("UPDATE shopping_list_image_uploads SET status = 'pending', lock_token = NULL WHERE r2_key = ? AND uid = ? AND lock_token = ?").bind(r2Key, uid, lockToken).run()
      return jsonError('R2 桶名未配置', 500)
    }

    let actualSize
    try {
      actualSize = await headR2ObjectSize(env, bucket, r2Key)
      if (actualSize === null) throw new Error('R2 对象不存在，请重新上传')
    } catch (error) {
      await db.prepare("UPDATE shopping_list_image_uploads SET status = 'pending', lock_token = NULL WHERE r2_key = ? AND uid = ? AND lock_token = ?").bind(r2Key, uid, lockToken).run()
      return jsonError(error.message || 'R2 对象确认失败', 400)
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const results = await db.batch([
      db.prepare(
        `UPDATE user_storage_quota SET used_bytes = used_bytes + ?, updated_at = ?
         WHERE uid = ? AND EXISTS (
           SELECT 1 FROM shopping_list_image_uploads
           WHERE r2_key = ? AND uid = ? AND status = 'confirming' AND lock_token = ?
         )`,
      ).bind(actualSize, now, uid, r2Key, uid, lockToken),
      db.prepare(
        `UPDATE shopping_list_image_uploads
         SET status = 'confirmed', actual_bytes = ?, lock_token = NULL, updated_at = ?
         WHERE r2_key = ? AND uid = ? AND status = 'confirming' AND lock_token = ?`,
      ).bind(actualSize, now, r2Key, uid, lockToken),
      db.prepare('DELETE FROM storage_reservations WHERE id = ? AND uid = ?').bind(reservationId, uid),
    ])
    if ((results?.[1]?.meta?.changes ?? 0) !== 1) return jsonError('图片确认失败，请重试', 409)
    return json({ size: actualSize })
  } catch (error) {
    console.error('Shopping list image confirm error:', error)
    return jsonError('图片确认失败，请稍后重试', 500)
  }
}
