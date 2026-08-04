// AI 媒体作品 API（所有路由统一走一个文件）
//   GET  /api/ai-media-works              公开列表（仅 approved）
//   POST /api/ai-media-works/batch        批量推送（X-API-Key 鉴权）
//   GET  /api/ai-media-works/categories   公开分类聚合（仅 approved）
//   GET  /api/ai-media-works/:id          公开详情（仅 approved，view_count+1）
//
// Cloudflare Pages Functions 路由：双中括号 [[path]] 匹配零或多段路径，
// 所以本文件同时处理根 /api/ai-media-works 与所有子路径 /api/ai-media-works/*。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
}

const VALID_TYPES = new Set(['image', 'video'])
const VALID_AUDIT = new Set(['approved', 'pending', 'rejected'])
const ALLOWED_KEY_LEN = 256

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 400) {
  return json({ success: false, error: message }, status)
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function checkApiKey(request, env) {
  const expected = env.AIMW_KEY
  if (!expected) {
    console.log('[ai-media-works] auth fail: env.AIMW_KEY is empty')
    return false
  }
  const got = (request.headers.get('X-API-Key') || '').trim()
  if (!got) {
    console.log('[ai-media-works] auth fail: X-API-Key header missing')
    return false
  }
  if (got.length > ALLOWED_KEY_LEN) return false
  if (got.length !== expected.length) {
    console.log(`[ai-media-works] auth fail: length mismatch got=${got.length} expected=${expected.length}`)
    return false
  }
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ got.charCodeAt(i)
  }
  if (diff !== 0) {
    console.log('[ai-media-works] auth fail: byte mismatch')
    return false
  }
  return true
}

function normalizeWork(raw) {
  if (!raw || typeof raw !== 'object') {
    throw { status: 400, message: '条目必须是对象' }
  }
  const media_type = String(raw.media_type || '').trim().toLowerCase()
  if (!VALID_TYPES.has(media_type)) {
    throw { status: 400, message: 'media_type 必须是 image 或 video' }
  }
  const media_url = String(raw.media_url || '').trim()
  if (!media_url || !/^https?:\/\//i.test(media_url)) {
    throw { status: 400, message: 'media_url 必须为 http(s) URL' }
  }
  const prompt = String(raw.prompt || '').trim()
  if (!prompt) throw { status: 400, message: 'prompt 必填' }
  if (prompt.length > 4000) throw { status: 400, message: 'prompt 长度不可超过 4000' }
  const category = String(raw.category || '').trim()
  if (!category) throw { status: 400, message: 'category 必填' }
  if (category.length > 64) throw { status: 400, message: 'category 长度不可超过 64' }

  const optionalString = (v, max) => {
    if (v == null || v === '') return null
    const s = String(v).trim()
    if (!s) return null
    return s.length > max ? s.slice(0, max) : s
  }
  const optionalUrl = (v) => {
    const s = optionalString(v, 1024)
    if (!s) return null
    return /^https?:\/\//i.test(s) ? s : null
  }
  const optionalInt = (v) => {
    if (v == null || v === '') return null
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : null
  }

  const audit_status = raw.audit_status ? String(raw.audit_status).trim().toLowerCase() : 'approved'
  if (!VALID_AUDIT.has(audit_status)) {
    throw { status: 400, message: 'audit_status 必须是 approved/pending/rejected' }
  }

  return {
    media_type,
    media_url,
    thumbnail_url: optionalUrl(raw.thumbnail_url) || (media_type === 'image' ? media_url : null),
    prompt,
    category,
    model_name: optionalString(raw.model_name, 128),
    source_name: optionalString(raw.source_name, 128),
    source_url: optionalUrl(raw.source_url),
    width: optionalInt(raw.width),
    height: optionalInt(raw.height),
    duration: optionalInt(raw.duration),
    file_size: optionalInt(raw.file_size),
    tags: optionalString(raw.tags, 256),
    audit_status,
  }
}

async function insertWork(db, row) {
  const now = nowSql()
  const result = await db
    .prepare(
      `INSERT INTO ai_media_works
        (media_type, media_url, thumbnail_url, prompt, category,
         model_name, source_name, source_url,
         width, height, duration, file_size, tags,
         audit_status, view_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .bind(
      row.media_type,
      row.media_url,
      row.thumbnail_url,
      row.prompt,
      row.category,
      row.model_name,
      row.source_name,
      row.source_url,
      row.width,
      row.height,
      row.duration,
      row.file_size,
      row.tags,
      row.audit_status,
      now,
      now,
    )
    .run()
  return result.meta?.last_row_id || 0
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(request.url)
  // URL 形如 /api/ai-media-works/batch 或 /api/ai-media-works/123
  const segs = url.pathname.split('/').filter(Boolean) // ['api', 'ai-media-works', 'batch' or '123' or 'categories']
  const path = segs[2] || ''

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  // ---------- GET /api/ai-media-works (列表) ----------
  if (request.method === 'GET' && !path) {
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
    const pageSize = Math.min(60, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 24))
    const category = (url.searchParams.get('category') || '').trim()
    const type = (url.searchParams.get('type') || '').trim().toLowerCase()
    const offset = (page - 1) * pageSize

    const where = [`audit_status = 'approved'`]
    const args = []
    if (category) {
      where.push('category = ?')
      args.push(category)
    }
    if (type && VALID_TYPES.has(type)) {
      where.push('media_type = ?')
      args.push(type)
    }
    const whereSql = `WHERE ${where.join(' AND ')}`

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM ai_media_works ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT id, media_type, media_url, thumbnail_url, prompt, category,
                model_name, source_name, width, height, duration,
                view_count, created_at
         FROM ai_media_works
         ${whereSql}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const totalPages = Math.ceil(total / pageSize)
    return json({
      success: true,
      data: {
        list: list.results || [],
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    })
  }

  // ---------- POST /api/ai-media-works/batch ----------
  if (request.method === 'POST' && path === 'batch') {
    if (!checkApiKey(request, env)) return jsonError('API Key 无效', 401)
    const body = await request.json().catch(() => null)
    if (!body || !Array.isArray(body.items)) {
      return jsonError('请求体需为 { items: [...] }', 400)
    }
    if (body.items.length === 0) {
      return json({ success: true, data: { inserted: 0, ids: [] } })
    }
    if (body.items.length > 100) {
      return jsonError('单次批量最多 100 条', 400)
    }
    const ids = []
    const errors = []
    for (let i = 0; i < body.items.length; i++) {
      try {
        const row = normalizeWork(body.items[i])
        const id = await insertWork(db, row)
        ids.push(id)
      } catch (e) {
        errors.push({ index: i, error: e.message || e })
      }
    }
    return json({
      success: true,
      data: {
        inserted: ids.length,
        ids,
        failed: errors.length,
        errors: errors.length ? errors : undefined,
      },
    })
  }

  // ---------- GET /api/ai-media-works/categories ----------
  if (request.method === 'GET' && path === 'categories') {
    const result = await db
      .prepare(
        `SELECT category, COUNT(*) AS count
         FROM ai_media_works
         WHERE audit_status = 'approved'
         GROUP BY category
         ORDER BY count DESC, category ASC`,
      )
      .all()
    return json({
      success: true,
      data: (result.results || []).map((r) => ({
        name: r.category,
        count: r.count,
      })),
    })
  }

  // ---------- GET /api/ai-media-works/:id ----------
  if (request.method === 'GET' && /^\d+$/.test(path)) {
    const id = parseInt(path, 10)
    const row = await db
      .prepare(
        `SELECT id, media_type, media_url, thumbnail_url, prompt, category,
                model_name, source_name, source_url,
                width, height, duration, file_size, tags,
                audit_status, view_count, created_at, updated_at
         FROM ai_media_works
         WHERE id = ? AND audit_status = 'approved'`,
      )
      .bind(id)
      .first()
    if (!row) return jsonError('作品不存在', 404)
    // 浏览次数 +1（fire-and-forget）
    db.prepare(`UPDATE ai_media_works SET view_count = view_count + 1 WHERE id = ?`)
      .bind(id)
      .run()
      .catch((e) => console.warn('[ai-media-works] view_count update fail:', e?.message))
    return json({ success: true, data: row })
  }

  return jsonError('不支持的请求方法或路径', 405)
}
