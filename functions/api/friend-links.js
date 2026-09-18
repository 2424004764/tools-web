// 友情链接公开接口
// GET  /api/friend-links           已审核通过的友链列表（页脚展示）
// POST /api/friend-links           游客提交友链申请（需审核后才展示）
import { ApiResponse, initDatabase } from '../utils/db.js'

const MAX_NAME = 40
const MAX_DESC = 80
const MAX_CONTACT = 80
const MAX_URL = 500
const SUBMIT_LIMIT_PER_IP_PER_DAY = 5

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

function sanitizeText(value, max) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function normalizeUrl(raw, request) {
  let s = String(raw || '').trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  let u
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  const host = (u.hostname || '').toLowerCase()
  if (!host || host === 'localhost' || host === '127.0.0.1') return null
  let reqHost = ''
  try { reqHost = new URL(request.url).hostname.toLowerCase() } catch { /* ignore */ }
  const selfHosts = new Set(['tool.fologde.com', 'www.fologde.com', 'fologde.com', reqHost].filter(Boolean))
  if (selfHosts.has(host)) return { error: 'self' }
  u.hash = ''
  u.hostname = host
  if (u.pathname !== '/' && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '')
  }
  let out
  if (u.pathname === '/' && !u.search) {
    out = `${u.protocol}//${u.host}`
  } else {
    out = u.toString()
  }
  if (out.length > MAX_URL) return null
  return out
}

function publicItem(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description || '',
  }
}

function isMissingTable(error) {
  const msg = String(error?.message || error || '')
  return /no such table/i.test(msg)
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
    if (request.method === 'GET') {
      const list = await db
        .prepare(
          `SELECT id, name, url, description
           FROM friend_links
           WHERE status = 'approved'
           ORDER BY sort_order ASC, created_at DESC
           LIMIT 100`,
        )
        .all()
      return ApiResponse.success({ data: (list.results || []).map(publicItem) }, origin)
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return ApiResponse.error('请求体需为 JSON', origin, 400)
      }

      const name = sanitizeText(body.name, MAX_NAME)
      const description = sanitizeText(body.description, MAX_DESC)
      const contact = sanitizeText(body.contact, MAX_CONTACT)
      const url = normalizeUrl(body.url, request)

      if (!name) return ApiResponse.error('请填写网站名称', origin, 400)
      if (url && typeof url === 'object' && url.error === 'self') {
        return ApiResponse.error('不能提交本站自己作为友链', origin, 400)
      }
      if (!url || typeof url !== 'string') return ApiResponse.error('请填写有效的 http(s) 网址', origin, 400)

      const ip = getClientIp(request)

      if (ip) {
        const recent = await db
          .prepare(
            `SELECT COUNT(*) AS c
             FROM friend_links
             WHERE submit_ip = ?
               AND created_at >= datetime('now', '-1 day')`,
          )
          .bind(ip)
          .first()
        if ((recent?.c || 0) >= SUBMIT_LIMIT_PER_IP_PER_DAY) {
          return ApiResponse.error('提交过于频繁，请明天再试', origin, 429)
        }
      }

      const existing = await db
        .prepare(`SELECT id, status FROM friend_links WHERE url = ?`)
        .bind(url)
        .first()

      if (existing) {
        if (existing.status === 'approved') {
          return ApiResponse.error('该网址已在友链列表中', origin, 409)
        }
        if (existing.status === 'pending') {
          return ApiResponse.error('该网址已提交，正在等待审核', origin, 409)
        }
        await db
          .prepare(
            `UPDATE friend_links
             SET name = ?, description = ?, contact = ?, status = 'pending',
                 reject_reason = NULL, reviewed_by = NULL, reviewed_at = NULL,
                 submit_ip = ?, updated_at = datetime('now')
             WHERE id = ?`,
          )
          .bind(name, description, contact, ip || null, existing.id)
          .run()
        return ApiResponse.success(
          { data: { id: existing.id, status: 'pending' }, message: '已重新提交，等待审核' },
          origin,
        )
      }

      const id = crypto.randomUUID()
      try {
        await db
          .prepare(
            `INSERT INTO friend_links (id, name, url, description, contact, status, submit_ip)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
          )
          .bind(id, name, url, description, contact, ip || null)
          .run()
      } catch (e) {
        if (/UNIQUE/i.test(String(e?.message || e))) {
          return ApiResponse.error('该网址已提交', origin, 409)
        }
        throw e
      }

      return ApiResponse.success(
        { data: { id, status: 'pending' }, message: '提交成功，审核通过后会显示在页脚' },
        origin,
        201,
      )
    }

    return ApiResponse.error('不支持的请求方法', origin, 405)
  } catch (error) {
    console.error('friend-links API error:', error)
    if (isMissingTable(error)) {
      if (request.method === 'GET') {
        return ApiResponse.success({ data: [] }, origin)
      }
      return ApiResponse.error('友链功能尚未初始化，请稍后再试', origin, 503)
    }
    return ApiResponse.error('内部服务器错误', origin, 500, error?.stack || error?.message)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
