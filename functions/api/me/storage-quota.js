// 当前登录用户的存储额度查询（前台消费）
// GET /api/me/storage-quota
// 返回 { ok, quotaBytes, usedBytes, pendingBytes, remainingBytes, price: { credits, bytes } }
//
// 鉴权：复用 extractUidFromRequest（model-resolver.js）；未登录 → 401
// 无额度行 → 全 0（不返回 404），前端按 0 处理

import { extractUidFromRequest } from '../_lib/model-resolver.js'
import { getStorageQuota } from '../../services/storageQuotaService.js'
import { STORAGE_BYTES_PER_CREDIT } from '../../config/storage.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return jsonError('请先登录', 401)

  try {
    const quota = await getStorageQuota(db, uid)
    return json({
      ok: true,
      uid,
      ...quota,
      price: {
        credits: 1,
        bytes: STORAGE_BYTES_PER_CREDIT,
      },
    })
  } catch (error) {
    console.error('/api/me/storage-quota error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
