import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse } from '../utils/db.js'
import { LifeTrajectoriesController } from '../controllers/lifeTrajectoriesController.js'

export class LifeTrajectoriesRouter {
  constructor(db) {
    this.controller = new LifeTrajectoriesController(db)
  }

  // 公开/登录 共用入口：
  //   GET            → 公开列表，无需登录
  //   POST           → 发布，必须登录
  //   DELETE /:id    → 删除，必须登录，且只能删自己发布的
  async handle(request, path, env, origin) {
    const method = request.method

    if (method === 'GET') {
      return await this.controller.index(origin)
    }

    // POST / DELETE 都需要登录
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }
    const user = authResult.user

    if (method === 'POST') {
      const data = await request.json()
      return await this.controller.store(data, user, origin)
    }

    if (method === 'DELETE') {
      const id = path.replace(/^\//, '').trim()
      return await this.controller.destroy(id, user, origin)
    }

    return ApiResponse.error('不支持的请求方法', origin, 405)
  }
}
