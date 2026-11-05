// Authenticated author editing for published blog posts.
import { ApiResponse, initDatabase } from '../../../utils/db.js'
import { extractUidFromRequest } from '../../_lib/model-resolver.js'

const MAX_TITLE = 120
const MAX_SUMMARY = 300
const MAX_COVER = 500
const MAX_CONTENT = 100 * 1024
const TAG_ALLOWED_RE = /[^\p{Script=Han}\p{L}\p{N} +\-#.]/gu

function sanitizeText(value, max) {
  let out = String(value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, max)
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
  return /^\/[^\s]*$/.test(cover) || /^https:\/\/[^\s]+$/i.test(cover) ? cover : ''
}

export async function onRequest(context) {
  const { request, env } = context
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  if (!['GET', 'PUT'].includes(request.method)) return ApiResponse.error('不支持的请求方法', origin, 405)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return ApiResponse.error('请先登录', origin, 401)

  const id = String(context.params?.id || '').trim()
  if (!id) return ApiResponse.error('文章不存在或无权编辑', origin, 404)

  const dbInit = initDatabase(env, context.waitUntil)
  if (!dbInit.success) return dbInit.response
  const db = dbInit.db

  try {
    if (request.method === 'GET') {
      const row = await db.prepare(
        `SELECT id, title, summary, cover, tags, related_tools, content
         FROM blog_posts
         WHERE id = ? AND author_id = ? AND author_type = 'user'
           AND status IN ('draft', 'pending', 'published', 'rejected')`,
      ).bind(id, uid).first()
      if (!row) return ApiResponse.error('文章不存在或无权编辑', origin, 404)
      return ApiResponse.success({ data: { post: row } }, origin)
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return ApiResponse.error('请求体需为 JSON', origin, 400)
    }

    const title = sanitizeText(body.title, MAX_TITLE)
    if (!title) return ApiResponse.error('文章标题不能为空', origin, 400)
    const content = String(body.content ?? '')
    if (!content.trim()) return ApiResponse.error('文章内容不能为空', origin, 400)
    if (content.length > MAX_CONTENT) return ApiResponse.error('文章内容过长（上限 100KB）', origin, 400)

    const result = await db.prepare(
      `UPDATE blog_posts
       SET title = ?, summary = ?, cover = ?, tags = ?, related_tools = ?, content = ?,
           status = 'pending', reviewed_by = NULL, reviewed_at = NULL, reject_reason = '',
           updated_at = datetime('now')
       WHERE id = ? AND author_id = ? AND author_type = 'user'
         AND status IN ('draft', 'pending', 'published', 'rejected')`,
    ).bind(
      title,
      sanitizeText(body.summary, MAX_SUMMARY),
      normalizeCover(body.cover),
      normalizeTags(body.tags),
      normalizeRelatedTools(body.related_tools),
      content,
      id,
      uid,
    ).run()

    if (!result.meta?.changes) return ApiResponse.error('文章不存在或无权编辑', origin, 404)
    return ApiResponse.success({ data: { id, status: 'pending' }, message: '修改已提交，审核通过后重新展示' }, origin)
  } catch (error) {
    console.error('blog author edit error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500, error?.stack || error?.message)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
