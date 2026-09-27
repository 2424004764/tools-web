// 自建评论公开接口
// GET  /api/comments?path=/md5&page=1&pageSize=10   某页面已审核通过的评论（分页）
// POST /api/comments                                提交评论（游客填昵称+邮箱，登录用户带 token 直接提交）
//                                                      所有评论一律 pending，后台审核通过后才会出现在 GET 里
import { ApiResponse, initDatabase } from '../utils/db.js'
import { extractUidFromRequest } from './_lib/model-resolver.js'

const MAX_CONTENT = 1000
const MAX_NICKNAME = 20
const MAX_EMAIL = 100
const MAX_PATH = 300
const MAX_TITLE = 200
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50
const SUBMIT_LIMIT_PER_IP_PER_DAY = 10

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

// 去标签 + 裁剪长度；评论正文保留换行（不折叠空白）
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

function normalizePath(raw) {
  let p = String(raw || '').trim()
  if (!p) return ''
  if (!p.startsWith('/')) p = '/' + p
  if (p.length > MAX_PATH) return ''
  // 只允许路径常见字符，挡住奇怪输入
  if (!/^[\/A-Za-z0-9_\-.,~%]+$/.test(p)) return ''
  return p
}

function publicItem(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    avatar: row.avatar || '',
    content: row.content,
    created_at: row.created_at,
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
    // ---- GET：已通过评论列表（分页） ----
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const pagePath = normalizePath(url.searchParams.get('path'))
      if (!pagePath) return ApiResponse.error('缺少有效的 path 参数', origin, 400)

      const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE))

      const totalRow = await db
        .prepare(`SELECT COUNT(*) AS c FROM comments WHERE page_path = ? AND status = 'approved'`)
        .bind(pagePath)
        .first()
      const total = totalRow?.c || 0

      const list = await db
        .prepare(
          `SELECT id, nickname, avatar, content, created_at
           FROM comments
           WHERE page_path = ? AND status = 'approved'
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(pagePath, pageSize, (page - 1) * pageSize)
        .all()

      const totalPages = Math.ceil(total / pageSize)
      return ApiResponse.success(
        {
          data: {
            list: (list.results || []).map(publicItem),
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

    // ---- POST：提交评论（一律进入待审核） ----
    if (request.method === 'POST') {
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return ApiResponse.error('请求体需为 JSON', origin, 400)
      }

      const pagePath = normalizePath(body.path)
      if (!pagePath) return ApiResponse.error('页面路径无效，无法定位评论', origin, 400)

      const content = sanitizeText(body.content, MAX_CONTENT)
      if (!content) return ApiResponse.error('评论内容不能为空', origin, 400)

      const pageTitle = sanitizeText(body.page_title, MAX_TITLE)

      // 登录用户：身份取自 JWT + user 表；游客：昵称 + 邮箱必填
      const uid = await extractUidFromRequest(request, env)
      let userId = null
      let nickname = ''
      let email = ''
      let avatar = ''

      if (uid) {
        const user = await db
          .prepare(`SELECT id, email, username, avatar FROM user WHERE id = ?`)
          .bind(uid)
          .first()
        if (!user) return ApiResponse.error('登录用户不存在，请重新登录', origin, 401)
        userId = user.id
        nickname = sanitizeText(user.username, MAX_NICKNAME) || '用户'
        email = sanitizeText(user.email, MAX_EMAIL)
        avatar = sanitizeText(user.avatar, 500)
      } else {
        nickname = sanitizeText(body.nickname, MAX_NICKNAME)
        email = sanitizeText(body.email, MAX_EMAIL)
        if (!nickname) return ApiResponse.error('请填写昵称', origin, 400)
        if (!email || !EMAIL_RE.test(email)) return ApiResponse.error('请填写有效的邮箱地址', origin, 400)
      }

      // 频率限制：同 IP 每天最多 10 条
      const ip = getClientIp(request)
      if (ip) {
        const recent = await db
          .prepare(
            `SELECT COUNT(*) AS c
             FROM comments
             WHERE submit_ip = ?
               AND created_at >= datetime('now', '-1 day')`,
          )
          .bind(ip)
          .first()
        if ((recent?.c || 0) >= SUBMIT_LIMIT_PER_IP_PER_DAY) {
          return ApiResponse.error('评论太频繁啦，请明天再试', origin, 429)
        }
      }

      const id = crypto.randomUUID()
      await db
        .prepare(
          `INSERT INTO comments (id, page_path, page_title, content, user_id, nickname, email, avatar, status, submit_ip)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        )
        .bind(id, pagePath, pageTitle, content, userId, nickname, email, avatar, ip || null)
        .run()

      return ApiResponse.success(
        {
          data: {
            id,
            nickname,
            avatar,
            content,
            created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
            status: 'pending',
          },
          message: '评论已提交，审核通过后将会展示',
        },
        origin,
        201,
      )
    }

    return ApiResponse.error('不支持的请求方法', origin, 405)
  } catch (error) {
    console.error('comments API error:', error)
    if (isMissingTable(error)) {
      if (request.method === 'GET') {
        return ApiResponse.success(
          {
            data: {
              list: [],
              pagination: { total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 0, hasNext: false, hasPrev: false },
            },
          },
          origin,
        )
      }
      return ApiResponse.error('评论功能尚未初始化，请稍后再试', origin, 503)
    }
    return ApiResponse.error('内部服务器错误', origin, 500, error?.stack || error?.message)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
