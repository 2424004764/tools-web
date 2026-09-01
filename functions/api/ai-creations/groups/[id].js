// 删除整组 AI 创作（含所有 image）
//   DELETE /api/ai-creations/groups/:id
//     鉴权（必须登录）
//     校验 group.uid === 当前 uid（越权防护）
//     流程：
//       1) 拉 group 下所有 image 的 r2_key
//       2) 并发调 R2 DELETE 清理对象（失败不阻断 D1 删除，孤儿 key 由后续清理脚本处理）
//       3) DELETE FROM ai_creation_groups WHERE id=? AND uid=?（ON DELETE CASCADE 删 images）
//     Resp: { deleted: { group_id, images: number, r2_deleted: number, r2_failed: number } }

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
  // segs: ['api', 'ai-creations', 'groups', ':id']
  const segs = url.pathname.split('/').filter(Boolean)
  const idStr = segs[3]
  const groupId = parseInt(idStr, 10)
  if (!Number.isFinite(groupId) || groupId <= 0) {
    return jsonError('group_id 不合法', 400)
  }

  try {
    // 1) 校验归属 + 列出所有 image 的 r2_key
    const groupRow = await db
      .prepare('SELECT id, uid FROM ai_creation_groups WHERE id = ?')
      .bind(groupId)
      .first()
    if (!groupRow) return jsonError('group 不存在', 404)
    if (groupRow.uid !== uid) return jsonError('无权访问该 group', 403)

    const imgsResult = await db
      .prepare(
        `SELECT id, media_url FROM ai_creation_images WHERE group_id = ?`,
      )
      .bind(groupId)
      .all()

    const images = imgsResult.results || []
    const imageCount = images.length

    // 2) 并发删 R2 对象（失败不阻断：避免部分失败导致 D1 残留不一致；r2_failed 由响应返回给前端记日志）
    const bucket = env.R2_BUCKET_NAME
    let r2Deleted = 0
    let r2Failed = 0
    if (bucket && imageCount > 0) {
      const results = await Promise.allSettled(
        images.map((img) => {
          // 推断 r2_key：media_url 可能是 R2 公网 URL（含 R2_PUBLIC_HOST）或已经是 r2_key 字符串。
          // 优先尝试从 media_url 解析 key；否则视为已失效（或本来就只是 r2_key 字符串）。
          const key = inferR2Key(env, img.media_url)
          if (!key) return Promise.resolve(false)
          return deleteR2Object(env, bucket, key).then(() => true).catch(() => false)
        }),
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value === true) r2Deleted++
        else r2Failed++
      }
    } else if (imageCount > 0) {
      // R2 未配置：视作删除失败，让前端记日志
      r2Failed = imageCount
    }

    // 3) 删 D1 group（CASCADE 自动删 images）
    const del = await db
      .prepare('DELETE FROM ai_creation_groups WHERE id = ? AND uid = ?')
      .bind(groupId, uid)
      .run()
    const dbDeleted = del?.meta?.changes ?? 0
    if (dbDeleted === 0) {
      return jsonError('删除失败（可能并发删除）', 409)
    }

    return json({
      group_id: groupId,
      images: imageCount,
      r2_deleted: r2Deleted,
      r2_failed: r2Failed,
    })
  } catch (e) {
    console.error('[ai-creations/groups/:id DELETE] error:', e?.message || e)
    return jsonError(e?.message || '服务器错误', 500)
  }
}

// 从 media_url 推断 r2_key：
//   - 如果是 http(s) URL 且 host 等于 R2_PUBLIC_HOST → 取 pathname 去前缀斜杠
//   - 否则认为是 raw key 字符串（极端情况）
function inferR2Key(env, mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null
  const host = env.R2_PUBLIC_HOST
  // raw key（无协议 / 形如 'ai-creations/...'）
  if (!/^https?:\/\//i.test(mediaUrl)) {
    return mediaUrl.replace(/^\/+/, '')
  }
  // 有协议但没有 host 配置：放弃（前端可能尚未配 R2_PUBLIC_HOST，本地数据为 r2_key 字符串）
  if (!host) return null
  try {
    const u = new URL(mediaUrl)
    if (u.host !== host) return null
    let p = u.pathname.replace(/^\/+/, '')
    // 兼容路径已被 encodeURIComponent 编码过的旧数据
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