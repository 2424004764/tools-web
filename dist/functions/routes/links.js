import { LinksController } from '../controllers/linksController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse, Pager } from '../utils/db.js'

export class LinksRouter {
  constructor(db) {
    this.controller = new LinksController(db)
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

      case 'POST':
        // POST /api/links - 创建短链接（无需登录）
        try {
          const data = await request.json()
          return await this.controller.store(data, origin)
        } catch {
          return ApiResponse.error('请求数据格式错误', origin, 400)
        }

      case 'DELETE':
        // DELETE /api/links/{slug} - 删除短链接
        if (!slug) {
          return ApiResponse.error('缺少短链接后缀', origin, 400)
        }
        return await this.controller.destroy(slug, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}
