// 购物清单图片上传确认（R2 PUT 成功后调用）
//   POST /api/shopping-lists/images/confirm
//     Body: { r2Key, reservationId? }
//     校验 r2Key 属于当前用户命名空间 → HEAD R2 拿真实大小 → 结算用量 + 释放预留
//     Resp: { ok: true, size }

import { extractUidFromRequest } from '../../_lib/model-resolver.js'
import { headR2ObjectSize } from '../../../services/r2.js'
import { settleReservation } from '../../../services/storageQuotaService.js'

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
    if (!r2Key.startsWith(`shopping-list/${uid}/`)) {
      return jsonError('r2Key 不在当前用户命名空间内', 403)
    }

    const bucket = env.R2_BUCKET_NAME
    if (!bucket) return jsonError('R2 桶名未配置', 500)

    // 真实大小以 R2 为准（防谎报 size 绕过校验）；对象不存在视为上传未完成
    const actualSize = await headR2ObjectSize(env, bucket, r2Key)
    if (actualSize === null) return jsonError('R2 对象不存在，请重新上传', 400)

    await settleReservation(db, uid, reservationId, actualSize)
    return json({ size: actualSize })
  } catch (error) {
    console.error('Shopping list image confirm error:', error)
    return jsonError('图片确认失败，请稍后重试', 500)
  }
}
