import { NotesController } from '../controllers/notesController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse } from '../utils/db.js'

export class NotesRouter {
  constructor(db) {
    this.controller = new NotesController(db)
  }

  // 路由分发 - 添加认证检查
  async handle(request, path, env) {
    // 提取用户信息
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error)
    }

    const user = authResult.user
    const id = path.substring(1)
    const hasId = path && path !== '/'

    switch (request.method) {
      case 'GET':
        if (!hasId) {
          // GET /api/notes - 获取当前用户的所有笔记
          return await this.controller.index(user)
        } else {
          // GET /api/notes/{id} - 根据ID获取当前用户的笔记
          return await this.controller.show(id, user)
        }

      case 'POST':
        // POST /api/notes - 为当前用户创建笔记
        if (hasId) {
          return ApiResponse.error('创建笔记不需要提供ID', 400)
        }
        const createData = await request.json()
        return await this.controller.store(createData, user)

      case 'PUT':
        // PUT /api/notes/{id} - 更新当前用户的笔记
        if (!hasId) {
          return ApiResponse.error('更新笔记需要提供ID', 400)
        }
        const updateData = await request.json()
        return await this.controller.update(id, updateData, user)

      case 'DELETE':
        // DELETE /api/notes/{id} - 删除当前用户的笔记
        if (!hasId) {
          return ApiResponse.error('删除笔记需要提供ID', 400)
        }
        return await this.controller.destroy(id, user)

      default:
        return ApiResponse.error('不支持的请求方法', 405)
    }
  }
}
