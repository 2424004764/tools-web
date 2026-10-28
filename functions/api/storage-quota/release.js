// 释放上传预留（放弃上传时调用）
// POST /api/storage-quota/release
//   Body: { reservationId: string }
//   返回 { ok: true, released: boolean }
//
// 预留超时（1 小时）自动失效，此处是主动提前释放；幂等。

import { extractUidFromRequest } from '../_lib/model-resolver.js'
import { deleteR2Object } from '../../services/r2.js'
const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
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
    const reservationId = String(body?.reservationId || '').trim()
    if (!reservationId) return jsonError('缺少 reservationId', 400)

    const intent = await db
      .prepare('SELECT r2_key FROM music_upload_intents WHERE uid = ? AND reservation_id = ?')
      .bind(uid, reservationId)
      .first()
    const results = await db.batch([
      db.prepare('DELETE FROM storage_reservations WHERE id = ? AND uid = ?').bind(reservationId, uid),
      db.prepare('DELETE FROM music_upload_intents WHERE uid = ? AND reservation_id = ?').bind(uid, reservationId),
    ])
    const released = (results?.[0]?.meta?.changes ?? 0) > 0
    if (intent?.r2_key && env.R2_BUCKET_NAME) {
      await deleteR2Object(env, env.R2_BUCKET_NAME, intent.r2_key).catch((error) => {
        console.error('failed to remove abandoned music upload:', error?.message || error)
      })
    }
    return json({ ok: true, released })
  } catch (error) {
    console.error('/api/storage-quota/release error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
