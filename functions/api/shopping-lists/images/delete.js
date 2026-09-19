// 购物清单图片删除（删 R2 对象 + 退回存储额度）
//   POST /api/shopping-lists/images/delete
//     Body: { url } 或 { r2Key }
//     校验对象属于当前用户命名空间 → HEAD 拿真实大小 → DELETE R2 → 退回额度
//     对象已不存在（404）→ 不退额度（防止重复调用刷额度）
//     Resp: { ok: true, deleted: boolean, refunded: number }

import { extractUidFromRequest } from '../../_lib/model-resolver.js'
import { deleteR2Object, headR2ObjectSize } from '../../../services/r2.js'
import { refundStorageUsage } from '../../../services/storageQuotaService.js'

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

    const bucket = env.R2_BUCKET_NAME
    if (!bucket) return jsonError('R2 桶名未配置', 500)

    // 先 HEAD 再删：拿真实大小用于退额度；404 说明早已删除，不重复退
    const size = await headR2ObjectSize(env, bucket, r2Key)
    if (size === null) {
      return json({ deleted: false, refunded: 0 })
    }
    await deleteR2Object(env, bucket, r2Key)
    await refundStorageUsage(db, uid, size)
    return json({ deleted: true, refunded: size })
  } catch (error) {
    console.error('Shopping list image delete error:', error)
    return jsonError('图片删除失败，请稍后重试', 500)
  }
}
