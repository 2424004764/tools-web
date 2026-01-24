import { PasswordController } from '../controllers/passwordController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse } from '../utils/db.js'

export class PasswordsRouter {
  constructor(db) {
    this.controller = new PasswordController(db)
  }

  // 路由分发 - 添加认证检查
  async handle(request, path, env, origin) {
    // 提取用户信息
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    const user = authResult.user

    // 解析路径: /api/passwords/entries 或 /api/passwords/groups
    const pathParts = path.split('/').filter(p => p)
    const resource = pathParts[0] // 'entries', 'groups', 'export', 'import'
    const id = pathParts[1] // 可选的 ID

    switch (request.method) {
      case 'GET':
        // 特殊路由：导出
        if (resource === 'export') {
          return await this.controller.exportEntries(user, origin)
        }

        // 提取查询参数
        const url = new URL(request.url)
        const queryParams = Object.fromEntries(url.searchParams)

        if (!id) {
          // GET /api/passwords/{resource} - 获取列表
          if (resource === 'entries') {
            return await this.controller.getEntries(user, origin, queryParams)
          } else if (resource === 'groups') {
            return await this.controller.getGroups(user, origin)
          } else {
            return ApiResponse.error('无效的资源路径', origin, 400)
          }
        } else {
          // GET /api/passwords/{resource}/{id} - 获取单个项目
          if (resource === 'entries') {
            return await this.controller.getEntry(id, user, origin)
          } else if (resource === 'groups') {
            return await this.controller.getGroup(id, user, origin)
          } else {
            return ApiResponse.error('无效的资源路径', origin, 400)
          }
        }

      case 'POST':
        // 特殊路由：导入
        if (resource === 'import') {
          const formData = await request.formData()
          const file = formData.get('file')
          return await this.controller.importEntries(file, user, origin)
        }

        // POST /api/passwords/{resource} - 创建项目
        if (id) {
          return ApiResponse.error('创建项目不需要提供ID', origin, 400)
        }
        const createData = await request.json()
        if (resource === 'entries') {
          return await this.controller.createEntry(createData, user, origin)
        } else if (resource === 'groups') {
          return await this.controller.createGroup(createData, user, origin)
        } else {
          return ApiResponse.error('无效的资源路径', origin, 400)
        }

      case 'PUT':
        // PUT /api/passwords/{resource}/{id} - 更新项目
        if (!id) {
          return ApiResponse.error('更新项目需要提供ID', origin, 400)
        }
        const updateData = await request.json()
        if (resource === 'entries') {
          return await this.controller.updateEntry(id, updateData, user, origin)
        } else if (resource === 'groups') {
          return await this.controller.updateGroup(id, updateData, user, origin)
        } else {
          return ApiResponse.error('无效的资源路径', origin, 400)
        }

      case 'DELETE':
        // DELETE /api/passwords/{resource}/{id} - 删除项目
        if (!id) {
          return ApiResponse.error('删除项目需要提供ID', origin, 400)
        }
        if (resource === 'entries') {
          return await this.controller.deleteEntry(id, user, origin)
        } else if (resource === 'groups') {
          return await this.controller.deleteGroup(id, user, origin)
        } else {
          return ApiResponse.error('无效的资源路径', origin, 400)
        }

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}
