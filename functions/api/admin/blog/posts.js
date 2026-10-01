// Admin 博客文章列表 + 新建
// GET  /api/admin/blog/posts?page=1&pageSize=20&status=draft|pending|published|rejected&keyword=
// POST /api/admin/blog/posts  body: { title, content, summary?, cover?, tags?, related_tools?, slug?, status? }
//      管理员直接发文：status 可为 'draft'（草稿）或 'published'（直接发布）。
//      作者信息取当前管理员对应的前台用户，author_type 固定 'admin'。
//      鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_STATUS = new Set(['draft', 'pending', 'published', 'rejected'])
const VALID_CREATE_STATUS = new Set(['draft', 'published'])
const MAX_TITLE = 120
const MAX_SUMMARY = 300
const MAX_TAGS = 200
const MAX_COVER = 500
const MAX_SLUG = 80
const MAX_CONTENT = 100 * 1024

const TAG_ALLOWED_RE = /[^\p{Script=Han}\p{L}\p{N} +\-#.]/gu

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

// 去标签 + 裁剪长度；正文/摘要保留换行
function sanitizeText(value, max) {
  let out = String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, max)
  const last = out.charCodeAt(out.length - 1)
  if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1)
  return out
}

function normalizeTags(raw) {
  const seen = new Set()
  const out = []
  for (const part of String(raw ?? '').split(/[,，、]/)) {
    const tag = part.replace(TAG_ALLOWED_RE, '').trim().slice(0, 20)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= 8) break
  }
  return out.join(',')
}

function normalizeRelatedTools(raw) {
  const seen = new Set()
  const out = []
  for (const part of String(raw ?? '').split(/[,，、]/)) {
    let tool = part.trim().slice(0, 100)
    if (!tool) continue
    if (!tool.startsWith('/')) tool = '/' + tool
    if (!/^\/[A-Za-z0-9_\-/]+$/.test(tool) || seen.has(tool)) continue
    seen.add(tool)
    out.push(tool)
    if (out.length >= 10) break
  }
  return out.join(',')
}

function normalizeCover(raw) {
  const cover = sanitizeText(raw, MAX_COVER)
  if (!cover) return ''
  if (/^\/[^\s]*$/.test(cover) || /^https:\/\/[^\s]+$/i.test(cover)) return cover
  return ''
}

const SLUG_RE = /^[a-z0-9-]{1,80}$/

async function generateSlug(db, custom) {
  const candidates = []
  if (custom) candidates.push(custom)
  for (let i = 0; i < 5; i++) {
    candidates.push('p-' + Math.random().toString(36).slice(2, 10))
  }
  for (const slug of candidates) {
    const hit = await db.prepare(`SELECT 1 AS x FROM blog_posts WHERE slug = ?`).bind(slug).first()
    if (!hit) return slug
  }
  return null
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  // ---- POST：管理员发文 ----
  if (request.method === 'POST') {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

    const title = sanitizeText(body.title, MAX_TITLE)
    if (!title) return jsonError('文章标题不能为空')

    const content = String(body.content ?? '')
    if (!content.trim()) return jsonError('文章内容不能为空')
    if (content.length > MAX_CONTENT) return jsonError('文章内容过长（上限 100KB）')

    const status = String(body.status || 'published').trim()
    if (!VALID_CREATE_STATUS.has(status)) return jsonError('status 必须是 draft/published')

    let customSlug = String(body.slug || '').trim().toLowerCase()
    if (customSlug && !SLUG_RE.test(customSlug)) {
      return jsonError('自定义链接只能包含小写字母、数字和连字符（≤80 位）')
    }

    try {
      // 作者展示信息取管理员对应的前台用户，缺失时回退「站长」
      let nickname = '站长'
      let avatar = ''
      const adminUser = await db
        .prepare(`SELECT username, avatar FROM user WHERE id = ?`)
        .bind(context.data?.adminUid || '')
        .first()
      if (adminUser?.username) nickname = sanitizeText(adminUser.username, 30) || nickname
      if (adminUser?.avatar) avatar = sanitizeText(adminUser.avatar, MAX_COVER)

      const slug = await generateSlug(db, customSlug)
      if (!slug) return jsonError('链接标识生成失败，请稍后重试', 500)

      const id = crypto.randomUUID()
      await db
        .prepare(
          `INSERT INTO blog_posts (id, slug, title, summary, content, cover, tags, related_tools,
                                   author_id, author_name, author_avatar, author_type, status,
                                   reviewed_by, reviewed_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?,
                   CASE WHEN ? = 'published' THEN ? ELSE NULL END,
                   CASE WHEN ? = 'published' THEN datetime('now') ELSE NULL END,
                   CASE WHEN ? = 'published' THEN datetime('now') ELSE NULL END)`,
        )
        .bind(
          id, slug, title,
          sanitizeText(body.summary, MAX_SUMMARY),
          content,
          normalizeCover(body.cover),
          normalizeTags(body.tags),
          normalizeRelatedTools(body.related_tools),
          context.data?.adminUid || null,
          nickname,
          avatar,
          status,
          status, context.data?.adminUid || null,
          status,
          status,
        )
        .run()

      const row = await db
        .prepare(
          `SELECT id, slug, title, summary, cover, tags, related_tools, author_id, author_name,
                  author_avatar, author_type, status, views, reject_reason, reviewed_by, reviewed_at,
                  published_at, created_at, updated_at
           FROM blog_posts WHERE id = ?`,
        )
        .bind(id)
        .first()
      return json(row, 201)
    } catch (error) {
      console.error('admin blog create error:', error)
      return jsonError(error.message || '服务器错误', 500)
    }
  }

  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const status = (url.searchParams.get('status') || '').trim()
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const offset = (page - 1) * pageSize

  try {
    const where = []
    const args = []
    if (status && VALID_STATUS.has(status)) {
      where.push('status = ?')
      args.push(status)
    }
    if (keyword) {
      where.push('(title LIKE ? OR summary LIKE ? OR author_name LIKE ? OR tags LIKE ?)')
      const like = `%${keyword.replace(/[%_]/g, '')}%`
      args.push(like, like, like, like)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM blog_posts ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT id, slug, title, summary, cover, tags, related_tools, author_id, author_name,
                author_avatar, author_type, status, views, reject_reason, reviewed_by, reviewed_at,
                published_at, created_at, updated_at
         FROM blog_posts
         ${whereSql}
         ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
                  created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const counts = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
           COUNT(*) AS total
         FROM blog_posts`,
      )
      .first()

    const totalPages = Math.ceil(total / pageSize)
    return json({
      list: list.results || [],
      counts: {
        pending: counts?.pending || 0,
        draft: counts?.draft || 0,
        published: counts?.published || 0,
        rejected: counts?.rejected || 0,
        total: counts?.total || 0,
      },
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('admin blog list error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
