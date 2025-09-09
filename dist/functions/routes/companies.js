import { CompaniesController } from '../controllers/companiesController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse, Pager } from '../utils/db.js'

export class CompaniesRouter {
  constructor(db) {
    this.controller = new CompaniesController(db)
  }

  // 路由分发 - 添加认证检查
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
          // GET /api/companies - 获取当前用户的所有公司记录（支持分页）
          const pager = Pager.fromRequest(request)
          return await this.controller.index(user, pager, origin)
        } else {
          // GET /api/companies/{id} - 根据ID获取当前用户的公司记录
          return await this.controller.show(id, user, origin)
        }

      case 'POST':
        // POST /api/companies - 为当前用户创建公司记录
        if (hasId) {
          return ApiResponse.error('创建公司记录不需要提供ID', origin, 400)
        }
        const createData = await request.json()
        return await this.controller.store(createData, user, origin)

      case 'PUT':
        // PUT /api/companies/{id} - 更新当前用户的公司记录
        if (!hasId) {
          return ApiResponse.error('更新公司记录需要提供ID', origin, 400)
        }
        const updateData = await request.json()
        return await this.controller.update(id, updateData, user, origin)

      case 'DELETE':
        // DELETE /api/companies/{id} - 删除当前用户的公司记录
        if (!hasId) {
          return ApiResponse.error('删除公司记录需要提供ID', origin, 400)
        }
        return await this.controller.destroy(id, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}