// 我的 AI 创作 - 保存到 R2 + D1
//   POST /api/ai-creations/save/init
//     鉴权 + 额度预扣 + 复用/创建 group + 给每个 image 签 R2 PUT URL
//     Body: { prompt_id?, scene, category?, model_name?, title?, tags?,
//             images: [{ upstream_url, prompt, file_size, content_type?, width?, height? }] }
//     安全约束（渗透测试 MEDIUM finding：配额绕过 + 任意类型文件上传）：
//       - 新上传图片必须带正整数 file_size（≤20MB/张）与白名单 content_type；
//         content-length / content-type 都锁进预签名，PUT 不符 R2 直接 403。
//       - 预留额度失败（0 配额 / 超额）一律 402，不允许存在跳过预扣的旁路。
//     Resp: { group_id, plan: [{ index, upload_url, r2_key, public_url, expires_at }] }
//
//   POST /api/ai-creations/save/confirm
//     鉴权 + 校验 group 归属当前 uid + 写入 ai_creation_images
//     Body: { group_id, images: [{ r2_key, public_url, prompt, width?, height?, file_size? }] }
//     Resp: { inserted: number, ids: number[] }

import { extractUidFromRequest } from '../../_lib/model-resolver.js'
import { serializeTagInput } from '../../_lib/ai-creation-tags.js'
import { signR2PutUrl, buildR2PublicUrl, headR2ObjectSize } from '../../../services/r2.js'
import { reserveStorage, settleReservation } from '../../../services/storageQuotaService.js'

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

const ALLOWED_SCENES = new Set(['ai-image-edit', 'ai-outfit', 'manual-upload'])
const ALLOWED_SOURCES = new Set(['ai_generated', 'manual_upload'])
const MAX_TITLE = 100
const MAX_PROMPT = 4000
const MAX_CATEGORY = 64
const MAX_MODEL = 128
const MAX_IMAGES_PER_BATCH = 8 // 单次最多 8 张（覆盖并发 1-5 + 余量）
// 单张新上传图片的大小上限（20MB 防呆值；真实占用仍受用户剩余额度约束）
const MAX_FILE_BYTES = 20 * 1024 * 1024

// 上传 MIME 白名单：content_type 由客户端声明并锁进签名，必须严格限制为静态图片，
// 否则可借 text/html / image/svg+xml 等在公开桶托管任意页面（存储型 XSS / 免费文件托管）。
// SVG 虽是图片但可内嵌 <script>，同样禁止。扩展名由白名单映射生成，不做兜底猜测。
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'], // 非标准写法，个别环境会出现
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
])

// 客户端声明的图片类型归一化（未声明默认 png，浏览器图片生成器的主流格式）
function declaredImageType(img) {
  return String(img.content_type || img.mime || 'image/png').toLowerCase().trim()
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
  // 可选标签（081）：手动上传时可随图带上；数组或逗号分隔字符串，空 = 不打（默认）
  const tagsStr = body.tags !== undefined && body.tags !== null ? serializeTagInput(body.tags) : ''
  const sourceType = body.source_type ? String(body.source_type).trim() : (scene === 'manual-upload' ? 'manual_upload' : 'ai_generated')
  if (!ALLOWED_SOURCES.has(sourceType)) return jsonError('source_type 不合法', 400)
  const images = Array.isArray(body.images) ? body.images : []
  if (images.length === 0) {
    return jsonError('images 不能为空', 400)
  }
  if (images.length > MAX_IMAGES_PER_BATCH) {
    return jsonError(`单次最多保存 ${MAX_IMAGES_PER_BATCH} 张图片`, 400)
  }
  for (const img of images) {
    if (!img || typeof img !== 'object' || (!img.upstream_url && sourceType !== 'manual_upload' && !img.existing_key) || !img.prompt) {
      return jsonError('images 每项必须包含 prompt，生成素材还需要 upstream_url 或 existing_key', 400)
    }
    if (String(img.prompt).length > MAX_PROMPT) {
      return jsonError(`单条 prompt 不能超过 ${MAX_PROMPT} 字符`, 400)
    }
    // 复用已持久化对象：只允许复用本人命名空间下的 generated-images（防越权引用他人对象）
    if (img.existing_key && !String(img.existing_key).startsWith(`generated-images/${uid}/`)) {
      return jsonError('existing_key 不在当前用户命名空间内', 403)
    }
    // 新上传对象：file_size 必填正整数并设上限，content_type 过白名单。
    // 两者都会锁进预签名（content-length / content-type），PUT 不符 R2 直接 403。
    if (!img.existing_key) {
      const size = Number(img?.file_size)
      if (!Number.isInteger(size) || size <= 0) {
        return jsonError('images 每项必须包含正整数 file_size（字节）', 400)
      }
      if (size > MAX_FILE_BYTES) {
        return jsonError(`单张图片不能超过 ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB`, 400)
      }
      if (!ALLOWED_IMAGE_TYPES.has(declaredImageType(img))) {
        return jsonError('不支持的图片类型（仅支持 JPEG / PNG / WebP / GIF）', 400)
      }
    }
  }

  // 1) 存储额度预留：file_size 必填后，declaredBytes 即本次新上传对象的字节合计，
  //    预留成功才建组 / 签 URL（顺序很重要：0 配额账号在任何 D1 写入前就被 402 挡住，
  //    否则可无限刷 group 行）。confirm 时按 R2 真实大小结算（长度已锁进签名，两者一致）。
  //    全部为 existing_key 复用的批次 declaredBytes=0：无新对象写入，无需预留
  //    （那份对象在生成持久化时已扣过额度，画廊只引用不再计费）。
  let reservationId = ''
  const declaredBytes = images.reduce(
    (sum, img) => (img?.existing_key ? sum : sum + Math.floor(Number(img.file_size))),
    0,
  )
  if (declaredBytes > 0) {
    const rid = await reserveStorage(db, uid, declaredBytes)
    if (!rid) {
      // 不允许跳过预扣的旁路（含 ai-image-edit）：否则 0 配额账号可无限上传（渗透测试 MEDIUM finding）
      return jsonError('存储空间不足，请先购买存储额度（1 积分 = 100MB）', 402)
    }
    reservationId = rid
  }

  // 2) 复用或创建 group：(uid, prompt_id) 作为唯一键；
  //    没有 prompt_id 的直接新建（即便重复提交也允许多个"未关联"组，便于后续按 group 单独管理）。
  let groupId
  if (promptId) {
    const existing = await db
      .prepare('SELECT id FROM ai_creation_groups WHERE uid = ? AND prompt_id = ?')
      .bind(uid, promptId)
      .first()
    if (existing) {
      groupId = existing.id
      // 顺手更新 title / category / model_name / updated_at（不覆盖已存在的非空字段）；
      // tags 只在该组还没有标签时写入（复用组不打断用户已整理好的标签）
      await db
        .prepare(
          `UPDATE ai_creation_groups
           SET source_type = ?,
               title = COALESCE(NULLIF(?, ''), title),
               category = COALESCE(NULLIF(?, ''), category),
               model_name = COALESCE(NULLIF(?, ''), model_name),
               tags = CASE WHEN tags IS NULL OR tags = '' THEN ? ELSE tags END,
               updated_at = ?
           WHERE id = ? AND uid = ?`,
        )
        .bind(sourceType, title || '', category || '', modelName || '', tagsStr, nowSql(), groupId, uid)
        .run()
    }
  }
  if (!groupId) {
    const now = nowSql()
    const ins = await db
      .prepare(
        `INSERT INTO ai_creation_groups
           (uid, prompt_id, scene, source_type, category, model_name, title, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(uid, promptId, scene, sourceType, category, modelName, title, tagsStr, now, now)
      .run()
    groupId = ins.meta?.last_row_id || 0
    if (!groupId) return jsonError('创建 group 失败', 500)
  }

  // 3) 给每个 image 签 R2 PUT URL
  const bucket = env.R2_BUCKET_NAME
  if (!bucket) return jsonError('R2 桶名未配置', 500)

  const plan = []
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    if (img.existing_key) {
      // 复用已持久化对象：无需签名上传 URL，confirm 只写 D1 行
      plan.push({
        index: i,
        reuse: true,
        upload_url: '',
        r2_key: String(img.existing_key),
        content_type: '',
        public_url: buildR2PublicUrl(env, String(img.existing_key)),
        expires_at: 0,
        upstream_url: String(img.upstream_url || ''),
        filename: String(img.filename || 'image.png').slice(0, 255),
        prompt: String(img.prompt),
        width: Number.isFinite(img.width) ? Number(img.width) : null,
        height: Number.isFinite(img.height) ? Number(img.height) : null,
      })
      continue
    }
    const rawType = declaredImageType(img)
    const ext = ALLOWED_IMAGE_TYPES.get(rawType) // 前置校验已保证命中白名单
    const uuid = genUuid()
    const r2Key = `ai-creations/${uid}/${groupId}/${uuid}.${ext}`
    const contentType = rawType
    // content-length 与 content-type 一并锁进签名：PUT 的实际字节数 / 类型与声明不符 → R2 直接 403。
    // 只锁类型不锁长度时，"声明 1 字节实际上传 1GB"无法在 R2 端被阻止（配额绕过的根源）。
    const { uploadUrl, expiresAt } = await signR2PutUrl(env, bucket, r2Key, contentType, {
      contentLength: Number(img.file_size),
    })
    const publicUrl = buildR2PublicUrl(env, r2Key)
    plan.push({
      index: i,
      upload_url: uploadUrl,
      r2_key: r2Key,
      content_type: contentType,
      public_url: publicUrl, // R2_PUBLIC_HOST 未配置时为 ''
      expires_at: expiresAt,
      upstream_url: String(img.upstream_url || ''),
      filename: String(img.filename || `image.${ext}`).slice(0, 255),
      prompt: String(img.prompt),
      width: Number.isFinite(img.width) ? Number(img.width) : null,
      height: Number.isFinite(img.height) ? Number(img.height) : null,
    })
  }

  return json({
    group_id: groupId,
    reservation_id: reservationId,
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

  // 校验每张图的 r2_key 命名空间：
  //   - ai-creations/{uid}/      本次新上传的对象
  //   - generated-images/{uid}/  生成持久化对象复用（生成时已扣过额度，这里不再结算）
  // key 同时做格式校验（长度 + 字符集），防止毒化数据借道落库。
  const uploadsPrefix = `ai-creations/${uid}/`
  const generatedPrefix = `generated-images/${uid}/`
  for (const img of images) {
    if (!img || typeof img !== 'object' || !img.r2_key || !img.prompt) {
      return jsonError('images 每项必须包含 r2_key 与 prompt', 400)
    }
    const key = String(img.r2_key)
    if (key.length > 512 || !/^[A-Za-z0-9][A-Za-z0-9/._-]*$/.test(key)) {
      return jsonError('r2_key 格式不合法', 400)
    }
    if (!key.startsWith(uploadsPrefix) && !key.startsWith(generatedPrefix)) {
      return jsonError('r2_key 不在当前用户命名空间内', 403)
    }
  }

  // 以 R2 真实大小为准结算存储额度（HEAD 失败/对象缺失回退前端声明值），并释放 init 时的预留。
  // 复用 generated-images 对象的行照常写入 file_size，但不参与结算（那份额度在持久化时已扣）。
  const reservationId = body.reservation_id ? String(body.reservation_id).trim() : ''
  const bucket = env.R2_BUCKET_NAME
  const actualSizes = await Promise.all(images.map(async (img) => {
    const declared = Number(img.file_size)
    const fallback = Number.isFinite(declared) && declared > 0 ? Math.floor(declared) : 0
    if (!bucket || !img.r2_key) return fallback
    try {
      const actual = await headR2ObjectSize(env, bucket, String(img.r2_key))
      return actual === null ? fallback : actual
    } catch {
      return fallback
    }
  }))
  const totalBytes = actualSizes.reduce(
    (s, x, i) => s + (String(images[i].r2_key).startsWith(generatedPrefix) ? 0 : x),
    0,
  )
  if (totalBytes > 0 || reservationId) {
    await settleReservation(db, uid, reservationId, totalBytes)
  }

  // 逐行 INSERT（避免 batch 死锁；同时每条独立错误也只影响自己）
  const now = nowSql()
  const ids = []
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const r2Key = String(img.r2_key)
    // media_url 一律服务端从 r2_key 计算，客户端传的 public_url 不再信任：
    // 曾经客户端可传任意 public_url 落库，DELETE 端再从 media_url 反推 key
    // 用服务端凭据删对象，造成跨租户任意对象删除（IDOR）。
    const mediaUrl = buildR2PublicUrl(env, r2Key) || r2Key // 没配 R2_PUBLIC_HOST 时回退到 r2_key
    const fileSize = actualSizes[i] || null
    const width = Number.isFinite(img.width) ? Number(img.width) : null
    const height = Number.isFinite(img.height) ? Number(img.height) : null
    try {
      const ins = await db
        .prepare(
          `INSERT INTO ai_creation_images
             (group_id, uid, media_type, media_url, r2_key, thumbnail_url, filename, prompt,
              width, height, file_size, created_at, updated_at)
           VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          groupId,
          uid,
          mediaUrl,
          r2Key,
          null, // thumbnail_url 暂存空，未来可由图像处理函数回填
          String(img.filename || 'image.png').slice(0, 255),
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