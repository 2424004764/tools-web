import { TodosController } from '../controllers/todosController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse, Pager } from '../utils/db.js'

export class TodosRouter {
  constructor(db) {
    this.controller = new TodosController(db)
  }

  async handle(request, path, env, origin) {
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
          const url = new URL(request.url)
          const filters = {
            title: url.searchParams.get('title') || '',
            priority: url.searchParams.get('priority') || ''
          }
          return await this.controller.index(user, pager, origin, filters)
        } else {
          return await this.controller.show(id, user, origin)
        }

      case 'POST':
        if (hasId) {
          return ApiResponse.error('创建待办事项不需要提供ID', origin, 400)
        }
        const createData = await request.json()
        return await this.controller.store(createData, user, origin)

      case 'PUT':
        if (!hasId) {
          return ApiResponse.error('更新待办事项需要提供ID', origin, 400)
        }
        const updateData = await request.json()
        return await this.controller.update(id, updateData, user, origin)

      case 'DELETE':
        if (!hasId) {
          return ApiResponse.error('删除待办事项需要提供ID', origin, 400)
        }
        return await this.controller.destroy(id, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}
