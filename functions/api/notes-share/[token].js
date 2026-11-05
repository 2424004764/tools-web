import { NotesController } from '../../controllers/notesController.js'
import { ApiResponse, initDatabase } from '../../utils/db.js'
import { getClientIp, hitLimit } from '../../utils/rate-limit.js'

const hashToken = async (token) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const withNoStore = (response) => {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export async function onRequest(context) {
  const { request, env, params } = context
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  const secureHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  }
  if (request.method !== 'GET') return ApiResponse.error('不支持的请求方法', origin, 405, null, secureHeaders)

  const token = String(params.token || '')
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return ApiResponse.error('分享内容不存在或已失效', origin, 404, null, secureHeaders)
  }

  const ip = getClientIp(request)
  if (ip && env.VERIFICATION_CODES) {
    const limit = await hitLimit(env.VERIFICATION_CODES, `rl:notes-share:${ip}`, 60, 60)
    if (!limit.allowed) {
      return ApiResponse.error('请求过于频繁，请稍后重试', origin, 429, null, {
        ...secureHeaders,
        'Retry-After': String(limit.retryAfterSec || 60),
      })
    }
  }

  const dbInit = initDatabase(env, context.waitUntil)
  if (!dbInit.success) return ApiResponse.error('服务暂不可用', origin, 503, null, secureHeaders)

  try {
    const controller = new NotesController(dbInit.db, env, context.waitUntil)
    const result = await controller.getSharedNote(await hashToken(token), origin)
    const headers = new Headers(result.headers)
    for (const [key, value] of Object.entries(secureHeaders)) headers.set(key, value)
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers })
  } catch (error) {
    console.error('Notes share API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500, null, secureHeaders)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
