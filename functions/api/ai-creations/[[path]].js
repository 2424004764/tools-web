// /api/ai-creations 我的 AI 创作素材（用户私有）
// 全部路由必须登录；WHERE 强制带 uid，避免任何越权访问。
//
//   GET /api/ai-creations          按 group 分页列出当前 uid 的创作组
//   GET /api/ai-creations/categories  当前 uid 出现的分类聚合
//
// 不在本次范围内：
//   POST（写入侧由 /ai-image-edit/ 等工具在生成完成后自行调用；后续扩展）

import { extractUidFromRequest } from '../_lib/model-resolver.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (request.method !== 'GET') {
    return jsonError('不支持的请求方法', 405)
  }

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return jsonError('请先登录', 401)

  const url = new URL(request.url)
  // URL 形如 /api/ai-creations 或 /api/ai-creations/categories
  const segs = url.pathname.split('/').filter(Boolean)
  const path = segs[2] || ''

  // ---------- GET /api/ai-creations/categories ----------
  if (path === 'categories') {
    const result = await db
      .prepare(
        `SELECT category, COUNT(*) AS count
         FROM ai_creation_groups
         WHERE uid = ? AND category IS NOT NULL AND category <> ''
         GROUP BY category
         ORDER BY count DESC, category ASC`,
      )
      .bind(uid)
      .all()
    return json({
      success: true,
      data: (result.results || []).map((r) => ({
        name: r.category,
        count: r.count,
      })),
    })
  }

  // ---------- GET /api/ai-creations (列表) ----------
  if (path === '') {
    const page = clampInt(url.searchParams.get('page'), 1, 9999, 1)
    const pageSize = clampInt(url.searchParams.get('pageSize'), 1, 60, 12)
    const category = (url.searchParams.get('category') || '').trim()
    const offset = (page - 1) * pageSize

    const where = [`g.uid = ?`]
    const args = [uid]
    if (category) {
      where.push('g.category = ?')
      args.push(category)
    }
    const whereSql = `WHERE ${where.join(' AND ')}`

    // 总组数 + 当前 uid 的总图片数（一次 JOIN 拿两个聚合，避免参数个数对不齐）
    // 关键：image_count 按 i.uid 过滤后再按 category 过滤，
    // 因为 image 表里只有 group_id，没有 category，所以需要 JOIN groups。
    const statsRow = await db
      .prepare(
        `SELECT
            (SELECT COUNT(*) FROM ai_creation_groups g ${whereSql}) AS group_count,
            (SELECT COUNT(*) FROM ai_creation_images i
              INNER JOIN ai_creation_groups g ON g.id = i.group_id
              WHERE i.uid = ? ${category ? 'AND g.category = ?' : ''}) AS image_count
        `,
      )
      .bind(...args, ...(category ? [uid, category] : [uid]))
      .first()
    const totalGroups = statsRow?.group_count || 0
    const totalImages = statsRow?.image_count || 0

    // 当前页的组
    const groupsRaw = await db
      .prepare(
        `SELECT g.id, g.uid, g.prompt_id, g.scene, g.category, g.model_name, g.title,
                g.created_at, g.updated_at,
                (SELECT COUNT(*) FROM ai_creation_images i WHERE i.group_id = g.id) AS image_count,
                (SELECT media_url FROM ai_creation_images WHERE group_id = g.id ORDER BY id ASC LIMIT 1) AS cover_url,
                (SELECT thumbnail_url FROM ai_creation_images WHERE group_id = g.id ORDER BY id ASC LIMIT 1) AS cover_thumb,
                (SELECT id FROM ai_creation_images WHERE group_id = g.id ORDER BY id ASC LIMIT 1) AS cover_id
         FROM ai_creation_groups g
         ${whereSql}
         ORDER BY g.created_at DESC, g.id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    // 组内图片（按当前页 group_id 一次性 IN 查询，避免 N+1）
    const groupIds = (groupsRaw.results || []).map((g) => g.id)
    let imagesByGroup = new Map()
    if (groupIds.length > 0) {
      const placeholders = groupIds.map(() => '?').join(',')
      const imgs = await db
        .prepare(
          `SELECT id, group_id, media_url, thumbnail_url, prompt, width, height, created_at
           FROM ai_creation_images
           WHERE uid = ? AND group_id IN (${placeholders})
           ORDER BY id ASC`,
        )
        .bind(uid, ...groupIds)
        .all()
      for (const img of imgs.results || []) {
        if (!imagesByGroup.has(img.group_id)) imagesByGroup.set(img.group_id, [])
        imagesByGroup.get(img.group_id).push(img)
      }
    }

    // 关联提示词库元数据（可空）
    const promptIds = (groupsRaw.results || [])
      .map((g) => g.prompt_id)
      .filter((p) => p != null && p !== '')
    let promptMap = new Map()
    if (promptIds.length > 0) {
      const placeholders = promptIds.map(() => '?').join(',')
      const prompts = await db
        .prepare(
          `SELECT id, title, content FROM user_tool_prompts WHERE uid = ? AND id IN (${placeholders})`,
        )
        .bind(uid, ...promptIds)
        .all()
      for (const p of prompts.results || []) {
        promptMap.set(p.id, { id: p.id, title: p.title, content: p.content })
      }
    }

    const groups = (groupsRaw.results || []).map((g) => {
      const images = (imagesByGroup.get(g.id) || []).map((img) => ({
        id: img.id,
        media_url: img.media_url,
        thumbnail_url: img.thumbnail_url,
        prompt: img.prompt,
        width: img.width,
        height: img.height,
        created_at: img.created_at,
      }))
      return {
        id: g.id,
        prompt_id: g.prompt_id,
        prompt: g.prompt_id ? promptMap.get(g.prompt_id) || null : null,
        scene: g.scene,
        category: g.category,
        model_name: g.model_name,
        title: g.title,
        created_at: g.created_at,
        image_count: Number(g.image_count) || images.length,
        cover: g.cover_id
          ? {
              id: g.cover_id,
              media_url: g.cover_url,
              thumbnail_url: g.cover_thumb,
            }
          : null,
        images,
      }
    })

    const totalPages = Math.ceil(totalGroups / pageSize)
    return json({
      success: true,
      data: {
        groups,
        pagination: {
          total: totalGroups,
          totalImages,
          page,
          pageSize,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    })
  }

  return jsonError('不支持的请求方法或路径', 405)
}