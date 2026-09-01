// 我的 AI 创作 - 保存到 R2 + D1
//   POST /api/ai-creations/save/init
//     鉴权 + 复用/创建 group + 给每个 image 签 R2 PUT URL
//     Body: { prompt_id?, scene, category?, model_name?, title?,
//             images: [{ upstream_url, prompt, width?, height? }] }
//     Resp: { group_id, plan: [{ index, upload_url, r2_key, public_url, expires_at }] }
//
//   POST /api/ai-creations/save/confirm
//     鉴权 + 校验 group 归属当前 uid + 写入 ai_creation_images
//     Body: { group_id, images: [{ r2_key, public_url, prompt, width?, height?, file_size? }] }
//     Resp: { inserted: number, ids: number[] }

import { extractUidFromRequest } from '../../_lib/model-resolver.js'
import { signR2PutUrl, buildR2PublicUrl } from '../../../services/r2.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function genUuid() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}_${Math.floor(Math.random() * 1e9).toString(36)}`
  }
}

const ALLOWED_SCENES = new Set(['ai-image-edit', 'ai-outfit'])
const MAX_TITLE = 100
const MAX_PROMPT = 4000
const MAX_CATEGORY = 64
const MAX_MODEL = 128
const MAX_IMAGES_PER_BATCH = 8 // 单次最多 8 张（覆盖并发 1-5 + 余量）

// 上游常见的图片 Content-Type 推断。绝大多数 LLM 出图为 PNG / JPEG。
function extFromContentType(ct) {
  const t = String(ct || '').toLowerCase()
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  return 'png' // 默认 png，浏览器图片生成器的主流格式
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

  const url = new URL(request.url)
  // 兼容 /api/ai-creations/save/init 与 /api/ai-creations/save (默认 init) 两种调用
  const segs = url.pathname.split('/').filter(Boolean)
  const path = segs[3] || 'init' // ['api', 'ai-creations', 'save', 'init' | 'confirm']

  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('请求体不是合法 JSON', 400)
  }
  if (!body || typeof body !== 'object') {
    return jsonError('请求体格式错误', 400)
  }

  try {
    if (path === 'confirm') {
      return await handleConfirm(db, uid, body, env)
    }
    return await handleInit(db, uid, body, env)
  } catch (e) {
    console.error('[ai-creations/save] error:', e?.message || e)
    return jsonError(e?.message || '服务器错误', 500)
  }
}

async function handleInit(db, uid, body, env) {
  const scene = String(body.scene || '').trim()
  if (!ALLOWED_SCENES.has(scene)) {
    return jsonError('scene 不合法', 400)
  }
  const promptId = body.prompt_id ? String(body.prompt_id).trim() : null
  const category = body.category ? String(body.category).trim().slice(0, MAX_CATEGORY) : null
  const modelName = body.model_name ? String(body.model_name).trim().slice(0, MAX_MODEL) : null
  const title = body.title ? String(body.title).trim().slice(0, MAX_TITLE) : null
  const images = Array.isArray(body.images) ? body.images : []
  if (images.length === 0) {
    return jsonError('images 不能为空', 400)
  }
  if (images.length > MAX_IMAGES_PER_BATCH) {
    return jsonError(`单次最多保存 ${MAX_IMAGES_PER_BATCH} 张图片`, 400)
  }
  for (const img of images) {
    if (!img || typeof img !== 'object' || !img.upstream_url || !img.prompt) {
      return jsonError('images 每项必须包含 upstream_url 与 prompt', 400)
    }
    if (String(img.prompt).length > MAX_PROMPT) {
      return jsonError(`单条 prompt 不能超过 ${MAX_PROMPT} 字符`, 400)
    }
  }

  // 1) 复用或创建 group：(uid, prompt_id) 作为唯一键；
  //    没有 prompt_id 的直接新建（即便重复提交也允许多个"未关联"组，便于后续按 group 单独管理）。
  let groupId
  if (promptId) {
    const existing = await db
      .prepare('SELECT id FROM ai_creation_groups WHERE uid = ? AND prompt_id = ?')
      .bind(uid, promptId)
      .first()
    if (existing) {
      groupId = existing.id
      // 顺手更新 title / category / model_name / updated_at（不覆盖已存在的非空字段）
      await db
        .prepare(
          `UPDATE ai_creation_groups
           SET title = COALESCE(NULLIF(?, ''), title),
               category = COALESCE(NULLIF(?, ''), category),
               model_name = COALESCE(NULLIF(?, ''), model_name),
               updated_at = ?
           WHERE id = ? AND uid = ?`,
        )
        .bind(title || '', category || '', modelName || '', nowSql(), groupId, uid)
        .run()
    }
  }
  if (!groupId) {
    const now = nowSql()
    const ins = await db
      .prepare(
        `INSERT INTO ai_creation_groups
           (uid, prompt_id, scene, category, model_name, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(uid, promptId, scene, category, modelName, title, now, now)
      .run()
    groupId = ins.meta?.last_row_id || 0
    if (!groupId) return jsonError('创建 group 失败', 500)
  }

  // 2) 给每个 image 签 R2 PUT URL
  const bucket = env.R2_BUCKET_NAME
  if (!bucket) return jsonError('R2 桶名未配置', 500)

  const plan = []
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const ext = extFromContentType(img.content_type || img.mime || '')
    const uuid = genUuid()
    const r2Key = `ai-creations/${uid}/${groupId}/${uuid}.${ext}`
    // 强制锁定为 image/png（与 SigV4 签名一致）；PNG 是浏览器原生支持的通用格式
    // 真实格式以 PUT 时 Content-Type 为准（这里统一用 image/png 简化）
    const contentType = 'image/png'
    const { uploadUrl, expiresAt } = await signR2PutUrl(env, bucket, r2Key, contentType)
    const publicUrl = buildR2PublicUrl(env, r2Key)
    plan.push({
      index: i,
      upload_url: uploadUrl,
      r2_key: r2Key,
      content_type: contentType,
      public_url: publicUrl, // R2_PUBLIC_HOST 未配置时为 ''
      expires_at: expiresAt,
      upstream_url: String(img.upstream_url),
      prompt: String(img.prompt),
      width: Number.isFinite(img.width) ? Number(img.width) : null,
      height: Number.isFinite(img.height) ? Number(img.height) : null,
    })
  }

  return json({
    group_id: groupId,
    plan,
  })
}

async function handleConfirm(db, uid, body, env) {
  const groupId = parseInt(body.group_id, 10)
  if (!Number.isFinite(groupId) || groupId <= 0) {
    return jsonError('group_id 不合法', 400)
  }
  const images = Array.isArray(body.images) ? body.images : []
  if (images.length === 0) {
    return jsonError('images 不能为空', 400)
  }
  if (images.length > MAX_IMAGES_PER_BATCH) {
    return jsonError(`单次最多保存 ${MAX_IMAGES_PER_BATCH} 张图片`, 400)
  }

  // 校验 group 归属当前 uid（核心安全检查）
  const group = await db
    .prepare('SELECT id, uid FROM ai_creation_groups WHERE id = ?')
    .bind(groupId)
    .first()
  if (!group) return jsonError('group 不存在', 404)
  if (group.uid !== uid) return jsonError('无权访问该 group', 403)

  // 校验每张图的 r2_key 命名空间必须以 ai-creations/{uid}/ 开头（防止越权写）
  const prefix = `ai-creations/${uid}/`
  for (const img of images) {
    if (!img || typeof img !== 'object' || !img.r2_key || !img.prompt) {
      return jsonError('images 每项必须包含 r2_key 与 prompt', 400)
    }
    if (!String(img.r2_key).startsWith(prefix)) {
      return jsonError('r2_key 不在当前用户命名空间内', 403)
    }
  }

  // 逐行 INSERT（避免 batch 死锁；同时每条独立错误也只影响自己）
  const now = nowSql()
  const ids = []
  for (const img of images) {
    const mediaUrl = String(img.public_url || img.r2_key) // 没配 R2_PUBLIC_HOST 时回退到 r2_key
    const fileSize = Number.isFinite(img.file_size) ? Number(img.file_size) : null
    const width = Number.isFinite(img.width) ? Number(img.width) : null
    const height = Number.isFinite(img.height) ? Number(img.height) : null
    try {
      const ins = await db
        .prepare(
          `INSERT INTO ai_creation_images
             (group_id, uid, media_type, media_url, thumbnail_url, prompt,
              width, height, file_size, created_at, updated_at)
           VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          groupId,
          uid,
          mediaUrl,
          null, // thumbnail_url 暂存空，未来可由图像处理函数回填
          String(img.prompt).slice(0, MAX_PROMPT),
          width,
          height,
          fileSize,
          now,
          now,
        )
        .run()
      if (ins.meta?.last_row_id) ids.push(ins.meta.last_row_id)
    } catch (e) {
      console.warn('[ai-creations/save/confirm] 单张写入失败:', e?.message || e)
    }
  }

  return json({
    inserted: ids.length,
    ids,
  })
}