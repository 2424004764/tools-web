// /api/ai-creations/claims  「认领」记录管理
// 用户声明某张 AI 图已发布到某平台（小红书/微博/公众号/视频号 + 自定义）。
// 全部按 uid 隔离，私有。
//
//   GET    /api/ai-creations/claims?imageIds=1,2,3  批量拉取一批图的所有认领
//                                              （前端「打开页面就拉一次」避免每次单独请求）
//   POST   /api/ai-creations/claims   { image_id, platform }   认领（重复认领同一平台幂等）
//   DELETE /api/ai-creations/claims   ?image_id=&platform=     取消单个认领
//
// 设计要点：
//   1. 列表用批量 GET，避免每张图单独请求
//   2. 前端对比「原列表 vs 用户新勾选」自己算增删，POST/DELETE 单条操作
//   3. 删图时由前端另调 DELETE（带 image_id）批量清理，DB 不设外键（用户要求）
//   4. platform 字符串去前后空格，长度 1..30（DB 也有 CHECK 兜底）

import { extractUidFromRequest } from '../_lib/model-resolver.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function jsonError(message, status) {
  return json({ success: false, error: message }, status)
}

// 解析 comma-separated 的 imageIds，限上限防滥用
function parseImageIds(raw) {
  if (!raw) return []
  const ids = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
  return [...new Set(ids)].slice(0, 500)
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return jsonError('请先登录', 401)

  const url = new URL(request.url)

  // ============ GET 批量拉取认领 ============
  // ?imageIds=1,2,3
  if (request.method === 'GET') {
    const imageIds = parseImageIds(url.searchParams.get('imageIds'))
    if (imageIds.length === 0) {
      return json({ success: true, data: [] })
    }
    const placeholders = imageIds.map(() => '?').join(',')
    const result = await db
      .prepare(
        `SELECT id, image_id, platform, created_at
         FROM ai_creation_claims
         WHERE uid = ? AND image_id IN (${placeholders})
         ORDER BY created_at ASC`,
      )
      .bind(uid, ...imageIds)
      .all()
    const claims = (result.results || []).map((r) => ({
      id: r.id,
      image_id: r.image_id,
      platform: r.platform,
      created_at: r.created_at,
    }))
    return json({ success: true, data: claims })
  }

  // ============ POST 单条认领（重复幂等）============
  if (request.method === 'POST') {
    let body
    try {
      body = await request.json()
    } catch {
      return jsonError('请求体不是合法 JSON', 400)
    }
    const imageId = parseInt(body.image_id, 10)
    const platform = String(body.platform || '').trim()
    if (!Number.isFinite(imageId) || imageId <= 0) {
      return jsonError('image_id 不合法', 400)
    }
    if (!platform || platform.length > 30) {
      return jsonError('平台名不合法（1-30 字符）', 400)
    }

    // 校验 image 属于当前 uid（防止越权给别人的图加认领）
    const img = await db
      .prepare('SELECT id FROM ai_creation_images WHERE id = ? AND uid = ?')
      .bind(imageId, uid)
      .first()
    if (!img) return jsonError('图片不存在或无权访问', 404)

    // UNIQUE INDEX 已经兜底幂等：同 image + platform 重复插入会被忽略
    // INSERT OR IGNORE 不会报错；返回受影响行数让前端知道是不是真新增了
    const res = await db
      .prepare(
        `INSERT OR IGNORE INTO ai_creation_claims (uid, image_id, platform)
         VALUES (?, ?, ?)`,
      )
      .bind(uid, imageId, platform)
      .run()
    // res.meta.changes 1 = 新增，0 = 已存在
    return json({
      success: true,
      data: {
        image_id: imageId,
        platform,
        created: (res?.meta?.changes ?? 0) > 0,
      },
    })
  }

  // ============ DELETE 单条 / 批量清理 ============
  //   ?image_id=&platform=          取消单个认领
  //   ?image_id=                    批量删该图所有认领（删图时调用）
  //   ?image_ids=1,2,3              批量删多张图的所有认领（删组时调用）
  if (request.method === 'DELETE') {
    const imageIdsRaw = url.searchParams.get('image_ids') || url.searchParams.get('imageIds')
    const singleImageId = parseInt(url.searchParams.get('image_id') || '', 10)
    const platform = (url.searchParams.get('platform') || '').trim()

    // 模式 A：批量删多张图的所有认领（删组时调用）
    if (imageIdsRaw) {
      const imageIds = parseImageIds(imageIdsRaw)
      if (imageIds.length === 0) return json({ success: true, data: { deleted: 0 } })
      const placeholders = imageIds.map(() => '?').join(',')
      const res = await db
        .prepare(
          `DELETE FROM ai_creation_claims
           WHERE uid = ? AND image_id IN (${placeholders})`,
        )
        .bind(uid, ...imageIds)
        .run()
      return json({
        success: true,
        data: { deleted: res?.meta?.changes ?? 0 },
      })
    }

    // 模式 B：删某张图的某个平台认领（取消认领）
    if (Number.isFinite(singleImageId) && singleImageId > 0 && platform) {
      const res = await db
        .prepare(
          `DELETE FROM ai_creation_claims
           WHERE uid = ? AND image_id = ? AND platform = ?`,
        )
        .bind(uid, singleImageId, platform)
        .run()
      return json({
        success: true,
        data: {
          image_id: singleImageId,
          platform,
          deleted: (res?.meta?.changes ?? 0) > 0,
        },
      })
    }

    // 模式 C：删某张图的所有认领（删图时调用）
    if (Number.isFinite(singleImageId) && singleImageId > 0) {
      const res = await db
        .prepare(
          `DELETE FROM ai_creation_claims
           WHERE uid = ? AND image_id = ?`,
        )
        .bind(uid, singleImageId)
        .run()
      return json({
        success: true,
        data: {
          image_id: singleImageId,
          deleted: res?.meta?.changes ?? 0,
        },
      })
    }

    return jsonError('缺少必要参数（image_id/platform、image_id、image_ids 之一）', 400)
  }

  return jsonError('不支持的请求方法', 405)
}
