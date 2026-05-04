import { BookmarksController } from '../controllers/bookmarksController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse, Pager } from '../utils/db.js'

export class BookmarksRouter {
  constructor(db) {
    this.controller = new BookmarksController(db)
  }

  async handle(request, path, env, origin) {
    // 提取用户信息
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    const user = authResult.user
    const id = path.substring(1)
    const hasId = path && path !== '/'

    switch (request.method) {
      case 'GET':
        if (!hasId) {
          const pager = Pager.fromRequest(request)
          return await this.controller.index(user, pager, origin)
        } else {
          return await this.controller.show(id, user, origin)
        }

      case 'POST':
        if (hasId) {
          return ApiResponse.error('创建书签不需要提供ID', origin, 400)
        }
        const createData = await request.json()
        return await this.controller.store(createData, user, origin)

      case 'PUT':
        if (!hasId) {
          return ApiResponse.error('更新书签需要提供ID', origin, 400)
        }
        const updateData = await request.json()
        return await this.controller.update(id, updateData, user, origin)

      case 'DELETE':
        if (!hasId) {
          return ApiResponse.error('删除书签需要提供ID', origin, 400)
        }
        return await this.controller.destroy(id, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}
