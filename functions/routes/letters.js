import { LettersController } from '../controllers/lettersController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse, Pager } from '../utils/db.js'

export class LettersRouter {
  constructor(db) {
    this.controller = new LettersController(db)
  }

  // 路由分发
  async handle(request, path, env, origin) {
    const id = path.substring(1)
    const hasId = path && path !== '/'

    switch (request.method) {
      case 'GET':
        // GET /api/letters - 获取当前用户的所有信件（需要登录）
        if (!hasId) {
          const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
          if (!authResult.success) {
            return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
          }
          const pager = Pager.fromRequest(request)
          return await this.controller.index(authResult.user, pager, origin)
        } else {
          return ApiResponse.error('不支持此操作', origin, 404)
        }

      case 'POST':
        // POST /api/letters - 创建信件（支持未登录用户）
        if (hasId) {
          return ApiResponse.error('创建信件不需要提供ID', origin, 400)
        }
        const createData = await request.json()

        // 可选认证，未登录也可以创建
        const authResult = await AuthMiddleware.extractUserFromRequestOptional(request, env)
        const user = authResult.user || { id: 'anonymous_' + Date.now() } // 未登录用户使用临时ID

        return await this.controller.store(createData, user, origin)

      case 'DELETE':
        // DELETE /api/letters/{id} - 删除信件（需要登录）
        if (!hasId) {
          return ApiResponse.error('删除信件需要提供ID', origin, 400)
        }
        const deleteAuthResult = await AuthMiddleware.extractUserFromRequest(request, env)
        if (!deleteAuthResult.success) {
          return AuthMiddleware.createAuthErrorResponse(deleteAuthResult.error, origin)
        }
        return await this.controller.destroy(id, deleteAuthResult.user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}
