// 用户反馈公开接口
// POST /api/feedback  提交反馈（游客 / 登录用户均可；登录用户自动带上账号信息）
import { ApiResponse, initDatabase } from '../utils/db.js'
import { extractUidFromRequest } from './_lib/model-resolver.js'

const MAX_CONTENT = 1000
const MIN_CONTENT = 5
const MAX_CONTACT = 100
const MAX_PAGE_URL = 300
const MAX_USER_AGENT = 200
const VALID_TYPES = new Set(['suggestion', 'bug', 'other'])
const LIMIT_PER_IP_PER_DAY = 10
const LIMIT_PER_UID_PER_DAY = 10

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
  if (request.method !== 'POST') {
    return ApiResponse.error('不支持的请求方法', origin, 405)
  }

  const dbInit = initDatabase(env, context.waitUntil)
  if (!dbInit.success) return dbInit.response
  const db = dbInit.db

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return ApiResponse.error('请求体需为 JSON', origin, 400)
    }

    const type = VALID_TYPES.has(body.type) ? body.type : 'suggestion'
    const content = sanitizeText(body.content, MAX_CONTENT)
    const contact = sanitizeText(body.contact, MAX_CONTACT)
    // page_url 只收站内路径（/xxx），避免塞外链
    let pageUrl = String(body.page_url ?? '').trim()
    if (!pageUrl.startsWith('/')) pageUrl = ''
    pageUrl = sanitizeText(pageUrl, MAX_PAGE_URL)
    const userAgent = sanitizeText(request.headers.get('User-Agent'), MAX_USER_AGENT)

    if (content.length < MIN_CONTENT) {
      return ApiResponse.error(`反馈内容至少 ${MIN_CONTENT} 个字`, origin, 400)
    }

    // 登录用户带上账号信息，方便后台回访；游客 uid 为空
    const uid = await extractUidFromRequest(request, env)
    let email = ''
    let username = ''
    if (uid) {
      const user = await db
        .prepare(`SELECT email, username FROM user WHERE id = ?`)
        .bind(uid)
        .first()
      email = sanitizeText(user?.email, 120)
      username = sanitizeText(user?.username, 60)
    }

    const ip = getClientIp(request)

    // 频率限制：同 IP / 同用户 每天 10 条
    if (ip) {
      const recent = await db
        .prepare(
          `SELECT COUNT(*) AS c FROM feedback
           WHERE submit_ip = ? AND created_at >= datetime('now', '-1 day')`,
        )
        .bind(ip)
        .first()
      if ((recent?.c || 0) >= LIMIT_PER_IP_PER_DAY) {
        return ApiResponse.error('反馈提交过于频繁，请明天再试', origin, 429)
      }
    }
    if (uid) {
      const recentByUid = await db
        .prepare(
          `SELECT COUNT(*) AS c FROM feedback
           WHERE uid = ? AND created_at >= datetime('now', '-1 day')`,
        )
        .bind(uid)
        .first()
      if ((recentByUid?.c || 0) >= LIMIT_PER_UID_PER_DAY) {
        return ApiResponse.error('反馈提交过于频繁，请明天再试', origin, 429)
      }
    }

    const id = crypto.randomUUID()
    await db
      .prepare(
        `INSERT INTO feedback (id, uid, email, username, type, content, contact, page_url, user_agent, submit_ip, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(
        id,
        uid || null,
        email,
        username,
        type,
        content,
        contact,
        pageUrl,
        userAgent,
        ip || null,
      )
      .run()

    return ApiResponse.success(
      { data: { id }, message: '感谢反馈！我们会认真查看每一条建议' },
      origin,
      201,
    )
  } catch (error) {
    console.error('feedback API error:', error)
    if (isMissingTable(error)) {
      return ApiResponse.error('反馈功能尚未初始化，请稍后再试', origin, 503)
    }
    return ApiResponse.error('内部服务器错误', origin, 500, error?.stack || error?.message)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
