// 博客公开接口
// GET  /api/blog/posts?page=1&pageSize=12&tag=&keyword=   已发布文章列表（分页 + 标签筛选 + 关键词搜索）
//      返回体附带 hotTags（已发布文章的热门标签 Top N，供列表页筛选 chips）
// POST /api/blog/posts                                    投稿（必须登录）。一律进入待审核（pending），
//                                                         后台审核通过后才会在 GET 中出现；同 IP 每日限 5 篇
import { ApiResponse, initDatabase } from '../../utils/db.js'
import { extractUidFromRequest } from '../_lib/model-resolver.js'

const MAX_TITLE = 120
const MAX_SUMMARY = 300
const MAX_TAGS = 200
const MAX_COVER = 500
const MAX_SLUG = 80
const MAX_CONTENT = 100 * 1024 // 100KB，Markdown 正文
const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 50
const SUBMIT_LIMIT_PER_IP_PER_DAY = 5
const HOT_TAGS_LIMIT = 14

// 标签白名单：中英文、数字、空格与常见技术符号；逗号/百分号等一律剔除（逗号是分隔符，% _ 是 LIKE 通配符）
const TAG_ALLOWED_RE = /[^\p{Script=Han}\p{L}\p{N} +\-#.]/gu

function getClientIp(request) {
  const cf = request.headers.get('CF-Connecting-IP')
  if (cf) return cf.trim()
  const xff = request.headers.get('X-Forwarded-For')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return ''
}

// 去标签 + 裁剪长度；正文/摘要保留换行
function sanitizeText(value, max) {
  let out = String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, max)
  // 末尾若是被截断的高位代理（emoji 等以代理对存储），去掉避免出现乱码
  const last = out.charCodeAt(out.length - 1)
  if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1)
  return out
}

// 标签归一化：按中英文逗号/顿号拆分 → 清洗 → 去空去重 → 最多 8 个、每个 ≤20 字
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

// 相关工具：只允许站内路径（/xxx），最多 10 个
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
  // 仅允许站内路径与 http(s) 外链，防 javascript: 等注入
  if (/^\/[^\s]*$/.test(cover) || /^https:\/\/[^\s]+$/i.test(cover)) return cover
  return ''
}

const SLUG_RE = /^[a-z0-9-]{1,80}$/

async function generateSlug(db, custom) {
  const candidates = []
  if (custom) candidates.push(custom)
  // 自动兜底：p-xxxxxx，碰撞时换随机串重试
  for (let i = 0; i < 5; i++) {
    candidates.push('p-' + Math.random().toString(36).slice(2, 10))
  }
  for (const slug of candidates) {
    const hit = await db.prepare(`SELECT 1 AS x FROM blog_posts WHERE slug = ?`).bind(slug).first()
    if (!hit) return slug
  }
  return null
}

// 列表页公开字段（不含 content，正文可能很大）
function listItem(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary || '',
    cover: row.cover || '',
    tags: row.tags || '',
    author_name: row.author_name,
    author_avatar: row.author_avatar || '',
    author_type: row.author_type,
    views: row.views || 0,
    published_at: row.published_at,
  }
}

function isMissingTable(error) {
  const msg = String(error?.message || error || '')
  return /no such table/i.test(msg)
}

// 热门标签：拉已发布文章的 tags 列，在 JS 里拆分聚合（量级小，不值得上递归 SQL）
async function collectHotTags(db) {
  const rows = await db
    .prepare(`SELECT tags FROM blog_posts WHERE status = 'published' AND tags != '' LIMIT 500`)
    .all()
  const counts = new Map()
  for (const row of rows.results || []) {
    for (const tag of String(row.tags).split(',')) {
      const t = tag.trim()
      if (!t) continue
      counts.set(t, (counts.get(t) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, HOT_TAGS_LIMIT)
    .map(([tag, count]) => ({ tag, count }))
}

export async function onRequest(context) {
  const { request, env } = context
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  const dbInit = initDatabase(env, context.waitUntil)
  if (!dbInit.success) return dbInit.response
  const db = dbInit.db

  try {
    // ---- GET：已发布文章列表（分页 + 标签筛选 + 关键词搜索） ----
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE))
      const keyword = sanitizeText(url.searchParams.get('keyword'), 60)
      const rawTag = String(url.searchParams.get('tag') || '').trim().slice(0, 20)
      // LIKE 通配符剔除（标签归一化已挡一层，这里兜底）
      const tag = rawTag.replace(/[%_]/g, '')

      const where = [`status = 'published'`]
      const args = []
      if (tag) {
        // tags 存储为 'a,b,c'，两侧补逗号后精确匹配 ,tag,
        where.push(`(',' || tags || ',') LIKE ?`)
        args.push(`%,${tag},%`)
      }
      if (keyword) {
        where.push(`(title LIKE ? OR summary LIKE ?)`)
        const like = `%${keyword.replace(/[%_]/g, '')}%`
        args.push(like, like)
      }
      const whereSql = `WHERE ${where.join(' AND ')}`

      const totalRow = await db
        .prepare(`SELECT COUNT(*) AS c FROM blog_posts ${whereSql}`)
        .bind(...args)
        .first()
      const total = totalRow?.c || 0

      const list = await db
        .prepare(
          `SELECT id, slug, title, summary, cover, tags, author_name, author_avatar, author_type, views, published_at
           FROM blog_posts
           ${whereSql}
           ORDER BY published_at DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(...args, pageSize, (page - 1) * pageSize)
        .all()

      const hotTags = await collectHotTags(db)
      const totalPages = Math.ceil(total / pageSize)
      return ApiResponse.success(
        {
          data: {
            list: (list.results || []).map(listItem),
            hotTags,
            pagination: {
              total,
              page,
              pageSize,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1,
            },
          },
        },
        origin,
      )
    }

    // ---- POST：投稿（必须登录，一律待审核） ----
    if (request.method === 'POST') {
      const uid = await extractUidFromRequest(request, env)
      if (!uid) return ApiResponse.error('请先登录后再投稿', origin, 401)

      const user = await db
        .prepare(`SELECT id, username, avatar, is_admin FROM user WHERE id = ?`)
        .bind(uid)
        .first()
      if (!user) return ApiResponse.error('登录用户不存在，请重新登录', origin, 401)

      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return ApiResponse.error('请求体需为 JSON', origin, 400)
      }

      const title = sanitizeText(body.title, MAX_TITLE)
      if (!title) return ApiResponse.error('文章标题不能为空', origin, 400)

      const content = String(body.content ?? '')
      if (!content.trim()) return ApiResponse.error('文章内容不能为空', origin, 400)
      if (content.length > MAX_CONTENT) return ApiResponse.error('文章内容过长（上限 100KB）', origin, 400)

      const summary = sanitizeText(body.summary, MAX_SUMMARY)
      const tags = normalizeTags(body.tags)
      const cover = normalizeCover(body.cover)
      const relatedTools = normalizeRelatedTools(body.related_tools)

      // 自定义 slug 可选；只允许小写字母/数字/连字符
      let customSlug = String(body.slug || '').trim().toLowerCase()
      if (customSlug) {
        if (!SLUG_RE.test(customSlug)) {
          return ApiResponse.error('自定义链接只能包含小写字母、数字和连字符（≤80 位）', origin, 400)
        }
      }

      // 频率限制：同 IP 每天最多 5 篇投稿
      const ip = getClientIp(request)
      if (ip) {
        const recent = await db
          .prepare(
            `SELECT COUNT(*) AS c FROM blog_posts
             WHERE submit_ip = ? AND created_at >= datetime('now', '-1 day')`,
          )
          .bind(ip)
          .first()
        if ((recent?.c || 0) >= SUBMIT_LIMIT_PER_IP_PER_DAY) {
          return ApiResponse.error('投稿太频繁啦，请明天再试', origin, 429)
        }
      }

      const slug = await generateSlug(db, customSlug)
      if (!slug) return ApiResponse.error('链接标识生成失败，请稍后重试', origin, 500)

      const id = crypto.randomUUID()
      await db
        .prepare(
          `INSERT INTO blog_posts (id, slug, title, summary, content, cover, tags, related_tools,
                                   author_id, author_name, author_avatar, author_type, status, submit_ip)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        )
        .bind(
          id,
          slug,
          title,
          summary,
          content,
          cover,
          tags,
          relatedTools,
          user.id,
          sanitizeText(user.username, 30) || '用户',
          sanitizeText(user.avatar, MAX_COVER),
          user.is_admin ? 'admin' : 'user',
          ip || null,
        )
        .run()

      return ApiResponse.success(
        {
          data: {
            id,
            slug,
            title,
            status: 'pending',
            created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
          },
          message: '投稿已提交，审核通过后将会展示',
        },
        origin,
        201,
      )
    }

    return ApiResponse.error('不支持的请求方法', origin, 405)
  } catch (error) {
    console.error('blog posts API error:', error)
    if (isMissingTable(error)) {
      if (request.method === 'GET') {
        return ApiResponse.success(
          {
            data: {
              list: [],
              hotTags: [],
              pagination: { total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 0, hasNext: false, hasPrev: false },
            },
          },
          origin,
        )
      }
      return ApiResponse.error('博客功能尚未初始化，请稍后再试', origin, 503)
    }
    return ApiResponse.error('内部服务器错误', origin, 500, error?.stack || error?.message)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
