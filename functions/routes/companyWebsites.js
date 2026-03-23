import { CompanyWebsitesController } from '../controllers/companyWebsitesController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse } from '../utils/db.js'

export class CompanyWebsitesRouter {
  constructor(db) {
    this.controller = new CompanyWebsitesController(db)
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
          // GET /api/company-websites - 获取当前用户的所有网站
          return await this.controller.index(user, origin)
        } else {
          // GET /api/company-websites/{id} - 根据ID获取网站
          return await this.controller.show(id, user, origin)
        }

      case 'POST':
        // POST /api/company-websites - 创建网站
        if (hasId) {
          return ApiResponse.error('创建网站不需要提供ID', origin, 400)
        }
        const createData = await request.json()
        return await this.controller.store(createData, user, origin)

      case 'PUT':
        // PUT /api/company-websites/{id} - 更新网站
        if (!hasId) {
          return ApiResponse.error('更新网站需要提供ID', origin, 400)
        }
        const updateData = await request.json()
        return await this.controller.update(id, updateData, user, origin)

      case 'DELETE':
        // DELETE /api/company-websites/{id} - 删除网站
        if (!hasId) {
          return ApiResponse.error('删除网站需要提供ID', origin, 400)
        }
        return await this.controller.destroy(id, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}
