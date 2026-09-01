// 删除单张 AI 创作图
//   DELETE /api/ai-creations/images/:id
//     鉴权（必须登录）
//     校验 image.uid === 当前 uid（越权防护）
//     流程：先删 R2 对象（best-effort），再 DELETE FROM ai_creation_images
//     Resp: { deleted: { image_id, group_id, r2_deleted, r2_failed } }

import { extractUidFromRequest } from '../../_lib/model-resolver.js'
import { deleteR2Object } from '../../../services/r2.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (request.method !== 'DELETE') {
    return jsonError('不支持的请求方法', 405)
  }

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return jsonError('请先登录', 401)

  const url = new URL(request.url)
  // segs: ['api', 'ai-creations', 'images', ':id']
  const segs = url.pathname.split('/').filter(Boolean)
  const idStr = segs[3]
  const imageId = parseInt(idStr, 10)
  if (!Number.isFinite(imageId) || imageId <= 0) {
    return jsonError('image_id 不合法', 400)
  }

  try {
    const row = await db
      .prepare('SELECT id, uid, group_id, media_url FROM ai_creation_images WHERE id = ?')
      .bind(imageId)
      .first()
    if (!row) return jsonError('image 不存在', 404)
    if (row.uid !== uid) return jsonError('无权访问该 image', 403)

    // best-effort 删 R2
    let r2Deleted = false
    let r2Failed = false
    const bucket = env.R2_BUCKET_NAME
    if (bucket) {
      const key = inferR2Key(env, row.media_url)
      if (key) {
        try {
          await deleteR2Object(env, bucket, key)
          r2Deleted = true
        } catch {
          r2Failed = true
        }
      }
    }

    const del = await db
      .prepare('DELETE FROM ai_creation_images WHERE id = ? AND uid = ?')
      .bind(imageId, uid)
      .run()
    const dbDeleted = del?.meta?.changes ?? 0
    if (dbDeleted === 0) {
      return jsonError('删除失败（可能并发删除）', 409)
    }

    return json({
      image_id: imageId,
      group_id: row.group_id,
      r2_deleted: r2Deleted,
      r2_failed: r2Failed,
    })
  } catch (e) {
    console.error('[ai-creations/images/:id DELETE] error:', e?.message || e)
    return jsonError(e?.message || '服务器错误', 500)
  }
}

function inferR2Key(env, mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null
  const host = env.R2_PUBLIC_HOST
  if (!/^https?:\/\//i.test(mediaUrl)) {
    return mediaUrl.replace(/^\/+/, '')
  }
  if (!host) return null
  try {
    const u = new URL(mediaUrl)
    if (u.host !== host) return null
    let p = u.pathname.replace(/^\/+/, '')
    try {
      p = decodeURIComponent(p)
    } catch {
      /* ignore */
    }
    return p
  } catch {
    return null
  }
}