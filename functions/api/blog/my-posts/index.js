// Current user's blog submissions, including posts awaiting review.
import { ApiResponse, initDatabase } from '../../../utils/db.js'
import { extractUidFromRequest } from '../../_lib/model-resolver.js'

export async function onRequest(context) {
  const { request, env } = context
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  if (request.method !== 'GET') return ApiResponse.error('不支持的请求方法', origin, 405)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return ApiResponse.error('请先登录', origin, 401)

  const dbInit = initDatabase(env, context.waitUntil)
  if (!dbInit.success) return dbInit.response

  try {
    const result = await dbInit.db.prepare(
      `SELECT id, slug, title, summary, tags, status, reject_reason, views,
              published_at, created_at, updated_at
       FROM blog_posts
       WHERE author_id = ? AND author_type = 'user'
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 100`,
    ).bind(uid).all()

    return ApiResponse.success({ data: { list: result.results || [] } }, origin)
  } catch (error) {
    console.error('my blog posts error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500, error?.stack || error?.message)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
