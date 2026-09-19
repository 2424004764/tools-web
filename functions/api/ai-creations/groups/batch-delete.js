// 批量删除整组 AI 创作（含所有 image）
//   POST /api/ai-creations/groups/batch-delete
//     body: { ids: number[] }（最多 50 个，去重取正整数）
//     鉴权（必须登录）；逐组校验 group.uid === 当前 uid，越权/不存在的 id 跳过并记入 skipped。
//     流程（每个 id）：拉组内 image 的 media_url → 并发删 R2（best-effort）→ DELETE group（CASCADE 删 images）
//     Resp: { groups_deleted, images, r2_deleted, r2_failed, skipped_ids }

import { extractUidFromRequest } from '../../_lib/model-resolver.js'
import { deleteR2Object, headR2ObjectSize } from '../../../services/r2.js'
import { refundStorageUsage } from '../../../services/storageQuotaService.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const MAX_IDS = 50

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

  if (request.method !== 'POST') {
    return jsonError('不支持的请求方法', 405)
  }

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return jsonError('请先登录', 401)

  const body = await request.json().catch(() => null)
  const rawIds = Array.isArray(body?.ids) ? body.ids : []
  // 去重 + 只保留正整数
  const ids = [...new Set(rawIds.map((v) => parseInt(v, 10)).filter((v) => Number.isFinite(v) && v > 0))]
  if (ids.length === 0) {
    return jsonError('ids 不能为空', 400)
  }
  if (ids.length > MAX_IDS) {
    return jsonError(`一次最多删除 ${MAX_IDS} 个合集`, 400)
  }

  try {
    const bucket = env.R2_BUCKET_NAME
    let groupsDeleted = 0
    let imageCount = 0
    let r2Deleted = 0
    let r2Failed = 0
    let refundedBytes = 0
    const skippedIds = []

    for (const groupId of ids) {
      const groupRow = await db
        .prepare('SELECT id, uid FROM ai_creation_groups WHERE id = ?')
        .bind(groupId)
        .first()
      // 不存在 / 越权：跳过（批量场景下不中断其它 id）
      if (!groupRow || groupRow.uid !== uid) {
        skippedIds.push(groupId)
        continue
      }

      const imgsResult = await db
        .prepare('SELECT id, media_url FROM ai_creation_images WHERE group_id = ?')
        .bind(groupId)
        .all()
      const images = imgsResult.results || []
      imageCount += images.length

      // best-effort 删 R2，失败不阻断 D1 删除；先 HEAD 拿真实大小（退额度用），404 → 不退（防刷额度）
      if (bucket && images.length > 0) {
        const results = await Promise.allSettled(
          images.map((img) => {
            const key = inferR2Key(env, img.media_url)
            if (!key) return Promise.resolve(0)
            return headR2ObjectSize(env, bucket, key)
              .then((size) => deleteR2Object(env, bucket, key).then(() => size || 0))
              .catch(() => 0)
          }),
        )
        for (const r of results) {
          if (r.status === 'fulfilled') {
            r2Deleted++
            refundedBytes += r.value || 0
          } else {
            r2Failed++
          }
        }
      } else if (images.length > 0) {
        r2Failed += images.length
      }

      const del = await db
        .prepare('DELETE FROM ai_creation_groups WHERE id = ? AND uid = ?')
        .bind(groupId, uid)
        .run()
      if ((del?.meta?.changes ?? 0) > 0) {
        groupsDeleted++
      } else {
        skippedIds.push(groupId)
      }
    }

    if (refundedBytes > 0) {
      try {
        await refundStorageUsage(db, uid, refundedBytes)
      } catch (e) {
        console.error('[ai-creations/groups/batch-delete POST] refundStorageUsage failed:', e?.message || e)
      }
    }

    return json({
      groups_deleted: groupsDeleted,
      images: imageCount,
      r2_deleted: r2Deleted,
      r2_failed: r2Failed,
      refunded_bytes: refundedBytes,
      skipped_ids: skippedIds,
    })
  } catch (e) {
    console.error('[ai-creations/groups/batch-delete POST] error:', e?.message || e)
    return jsonError(e?.message || '服务器错误', 500)
  }
}

// 从 media_url 推断 r2_key（与 groups/[id].js 同逻辑）
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
