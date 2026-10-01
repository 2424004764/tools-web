// 博客文章详情（公开）
// GET /api/blog/posts/:slug   按 slug 取已发布文章；浏览量异步 +1（waitUntil，不阻塞响应）
import { ApiResponse, initDatabase } from '../../../utils/db.js'

export async function onRequest(context) {
  const { request, env, params } = context
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }
  if (request.method !== 'GET') {
    return ApiResponse.error('不支持的请求方法', origin, 405)
  }

  const slug = String(params?.slug || '').trim()
  if (!slug || slug.length > 80 || !/^[a-z0-9-]+$/i.test(slug)) {
    return ApiResponse.error('文章不存在', origin, 404)
  }

  const dbInit = initDatabase(env, context.waitUntil)
  if (!dbInit.success) return dbInit.response
  const db = dbInit.db

  try {
    const row = await db
      .prepare(
        `SELECT id, slug, title, summary, content, cover, tags, related_tools,
                author_name, author_avatar, author_type, views, published_at, updated_at
         FROM blog_posts
         WHERE slug = ? AND status = 'published'`,
      )
      .bind(slug)
      .first()

    if (!row) return ApiResponse.error('文章不存在或未发布', origin, 404)

    // 浏览量 +1：异步执行，失败只记控制台
    const bumpViews = db
      .prepare(`UPDATE blog_posts SET views = views + 1 WHERE id = ?`)
      .bind(row.id)
      .run()
    if (typeof context.waitUntil === 'function') {
      context.waitUntil(bumpViews.catch((e) => console.error('blog view bump failed:', e)))
    } else {
      bumpViews.catch(() => {})
    }

    return ApiResponse.success({ data: { post: row } }, origin)
  } catch (error) {
    console.error('blog post detail error:', error)
    const msg = String(error?.message || error || '')
    if (/no such table/i.test(msg)) {
      return ApiResponse.error('博客功能尚未初始化，请稍后再试', origin, 503)
    }
    return ApiResponse.error('内部服务器错误', origin, 500, error?.stack || error?.message)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
