// Admin 博客文章单条
// PUT    /api/admin/blog/posts/:id
//        body: 内容字段（title/summary/content/cover/tags/related_tools/slug 任选）+
//              status: 'published' | 'draft' | 'rejected' | 'pending' + reject_reason（拒绝时）
//        审核语义：pending → published 即通过（published_at 为空时写入当前时间）；
//                  → rejected 即驳回（可附理由）；→ draft 下线；→ pending 撤回重审
// DELETE /api/admin/blog/posts/:id
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_STATUS = new Set(['draft', 'pending', 'published', 'rejected'])
const MAX_TITLE = 120
const MAX_SUMMARY = 300
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

const FULL_FIELDS = `id, slug, title, summary, cover, tags, related_tools, author_id, author_name,
                     author_avatar, author_type, status, views, reject_reason, reviewed_by,
                     reviewed_at, published_at, created_at, updated_at`

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  const id = context.params?.id
  if (!id) return jsonError('缺少 id', 400)

  try {
    const existing = await db
      .prepare(`SELECT id, slug, status, published_at FROM blog_posts WHERE id = ?`)
      .bind(id)
      .first()
    if (!existing) return jsonError('文章不存在', 404)

    // ---- GET：单篇详情（编辑回填用，含正文） ----
    if (request.method === 'GET') {
      const row = await db
        .prepare(`SELECT ${FULL_FIELDS}, content FROM blog_posts WHERE id = ?`)
        .bind(id)
        .first()
      return json(row)
    }

    if (request.method === 'DELETE') {
      await db.prepare(`DELETE FROM blog_posts WHERE id = ?`).bind(id).run()
      return json({ id, deleted: true })
    }

    if (request.method !== 'PUT') return jsonError('不支持的请求方法', 405)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

    const sets = [`updated_at = datetime('now')`]
    const args = []

    // ---- 内容字段：任选更新 ----
    if (body.title !== undefined) {
      const title = sanitizeText(body.title, MAX_TITLE)
      if (!title) return jsonError('文章标题不能为空')
      sets.push('title = ?')
      args.push(title)
    }
    if (body.summary !== undefined) {
      sets.push('summary = ?')
      args.push(sanitizeText(body.summary, MAX_SUMMARY))
    }
    if (body.cover !== undefined) {
      sets.push('cover = ?')
      args.push(normalizeCover(body.cover))
    }
    if (body.tags !== undefined) {
      sets.push('tags = ?')
      args.push(normalizeTags(body.tags))
    }
    if (body.related_tools !== undefined) {
      sets.push('related_tools = ?')
      args.push(normalizeRelatedTools(body.related_tools))
    }
    if (body.content !== undefined) {
      const content = String(body.content ?? '')
      if (!content.trim()) return jsonError('文章内容不能为空')
      if (content.length > MAX_CONTENT) return jsonError('文章内容过长（上限 100KB）')
      sets.push('content = ?')
      args.push(content)
    }
    if (body.slug !== undefined) {
      const slug = String(body.slug || '').trim().toLowerCase()
      if (!SLUG_RE.test(slug)) return jsonError('链接标识只能包含小写字母、数字和连字符（≤80 位）')
      if (slug !== existing.slug) {
        const hit = await db
          .prepare(`SELECT 1 AS x FROM blog_posts WHERE slug = ? AND id != ?`)
          .bind(slug, id)
          .first()
        if (hit) return jsonError('该链接标识已被其他文章使用')
        sets.push('slug = ?')
        args.push(slug)
      }
    }

    // ---- 状态字段：审核 / 上下线 ----
    if (body.status !== undefined) {
      const status = String(body.status || '').trim()
      if (!VALID_STATUS.has(status)) return jsonError('status 必须是 draft/pending/published/rejected')

      sets.push('status = ?')
      args.push(status)
      sets.push('reviewed_by = ?')
      args.push(context.data?.adminUid || null)
      sets.push(`reviewed_at = datetime('now')`)

      if (status === 'rejected') {
        sets.push('reject_reason = ?')
        args.push(sanitizeText(body.reject_reason, 200))
      } else {
        sets.push('reject_reason = ?')
        args.push('')
      }
      if (status === 'published') {
        // 首次发布写 published_at；重新上架保留原发布时间
        sets.push(`published_at = COALESCE(published_at, datetime('now'))`)
      }
      // 审核动作只允许对投稿（pending/rejected）操作；draft/published 间切换不需要 reviewed_*，
      // 但多写不伤语义（reviewed_by 即最近操作人），保持实现简单
    }

    if (sets.length === 1) return jsonError('没有可更新的字段')

    args.push(id)
    await db
      .prepare(`UPDATE blog_posts SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...args)
      .run()

    const row = await db
      .prepare(`SELECT ${FULL_FIELDS} FROM blog_posts WHERE id = ?`)
      .bind(id)
      .first()

    // 对外返回时补上正文（编辑弹窗回填用）
    if (row) {
      const withContent = await db
        .prepare(`SELECT content FROM blog_posts WHERE id = ?`)
        .bind(id)
        .first()
      row.content = withContent?.content ?? ''
    }
    return json(row)
  } catch (error) {
    console.error('admin blog item error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
