import { LinksController } from '../controllers/linksController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse, Pager } from '../utils/db.js'

export async function takeCreateSlot(db, request) {
  const ip = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown'
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  const ipHash = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const day = new Date().toISOString().slice(0, 10)
  const result = await db.prepare(
    `INSERT INTO short_link_submit_limits (ip_hash, submit_date, created_count)
     VALUES (?, ?, 1)
     ON CONFLICT(ip_hash, submit_date) DO UPDATE SET created_count = created_count + 1
     WHERE created_count < 20`,
  ).bind(ipHash, day).run()
  return (result?.meta?.changes ?? 0) > 0
}

export class LinksRouter {
  constructor(db, env = null, waitUntil = null) {
    this.db = db
    this.controller = new LinksController(db, env, waitUntil)
  }

  async handle(request, path, env, origin) {
    const slug = path.substring(1)

    switch (request.method) {
      case 'GET':
        if (slug) {
          // GET /api/links/{slug} - 获取短链接信息
          return await this.controller.show(slug, origin)
        }

        // GET /api/links - 需要登录查看自己的链接列表
        const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
        if (!authResult.success) {
          return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
        }
        const pager = Pager.fromRequest(request)
        return await this.controller.index(authResult.user.id, pager, origin)

      case 'POST': {
        let data
        try {
          data = await request.json()
        } catch {
          return ApiResponse.error('请求数据格式错误', origin, 400)
        }
        const authResult = await AuthMiddleware.extractUserFromRequestOptional(request, env)
        try {
          if (!(await takeCreateSlot(this.db, request))) {
            return ApiResponse.error('短链接创建过于频繁，请明天再试', origin, 429)
          }
        } catch (error) {
          console.error('short link rate limit failed:', error)
          return ApiResponse.error('短链接服务暂不可用', origin, 503)
        }
        return await this.controller.store(data, origin, authResult.user?.id || null)
      }
      case 'DELETE':
        if (!slug) {
          return ApiResponse.error('缺少短链接后缀', origin, 400)
        }
        {
          const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
          if (!authResult.success) {
            return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
          }
          return await this.controller.destroy(slug, authResult.user.id, origin)
        }

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}
