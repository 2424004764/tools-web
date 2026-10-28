import { MockSchemasController } from '../controllers/mockSchemasController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse, Pager } from '../utils/db.js'

export class MockSchemasRouter {
  constructor(db, env = null, waitUntil = null) {
    this.controller = new MockSchemasController(db, env, waitUntil)
  }

  async handle(request, path, env, origin) {
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)

    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    const user = authResult.user
    const id = path ? path.replace(/^\//, '') : ''
    const hasId = !!id

    switch (request.method) {
      case 'GET':
        if (hasId) return await this.controller.show(id, user, origin)
        return await this.controller.index(user, Pager.fromRequest(request, 100), origin)

      case 'POST':
        if (hasId) return ApiResponse.error('创建 mock 配方不需要提供 ID', origin, 400)
        return await this.controller.store(await request.json(), user, origin)

      case 'PUT':
        if (!hasId) return ApiResponse.error('更新 mock 配方需要提供 ID', origin, 400)
        return await this.controller.update(id, await request.json(), user, origin)

      case 'DELETE':
        if (!hasId) return ApiResponse.error('删除 mock 配方需要提供 ID', origin, 400)
        return await this.controller.destroy(id, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}
