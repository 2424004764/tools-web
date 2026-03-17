import { WeightController } from '../controllers/weightController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse } from '../utils/db.js'

export class WeightRouter {
  constructor(db) {
    this.controller = new WeightController(db)
  }

  // 路由分发 - 添加认证检查
  async handle(request, path, env, origin) {
    // 提取用户信息
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    const user = authResult.user

    // 解析路径: /api/weight/members 或 /api/weight/records
    const pathParts = path.split('/').filter(p => p)
    const resource = pathParts[0] // 'members', 'records', 'statistics', 'chart', 'export'
    const id = pathParts[1] // 可选的 ID

    switch (request.method) {
      case 'GET':
        // 特殊路由：统计、图表、导出
        if (resource === 'statistics') {
          const url = new URL(request.url)
          const queryParams = Object.fromEntries(url.searchParams)
          return await this.controller.getStatistics(user, origin, queryParams)
        }

        if (resource === 'chart') {
          const url = new URL(request.url)
          const queryParams = Object.fromEntries(url.searchParams)
          return await this.controller.getChartData(user, origin, queryParams)
        }

        if (resource === 'export') {
          return await this.controller.exportData(user, origin)
        }

        // 提取查询参数
        const url = new URL(request.url)
        const queryParams = Object.fromEntries(url.searchParams)

        if (!id) {
          // GET /api/weight/{resource} - 获取列表
          if (resource === 'members') {
            return await this.controller.getMembers(user, origin)
          } else if (resource === 'records') {
            return await this.controller.getRecords(user, origin, queryParams)
          } else {
            return ApiResponse.error('无效的资源路径', origin, 400)
          }
        } else {
          // GET /api/weight/{resource}/{id} - 获取单个项目
          if (resource === 'members') {
            return await this.controller.getMember(id, user, origin)
          } else if (resource === 'records') {
            return await this.controller.getRecord(id, user, origin)
          } else {
            return ApiResponse.error('无效的资源路径', origin, 400)
          }
        }

      case 'POST':
        // POST /api/weight/{resource} - 创建项目
        if (id) {
          return ApiResponse.error('创建项目不需要提供ID', origin, 400)
        }
        const createData = await request.json()
        if (resource === 'members') {
          return await this.controller.createMember(createData, user, origin)
        } else if (resource === 'records') {
          return await this.controller.createRecord(createData, user, origin)
        } else {
          return ApiResponse.error('无效的资源路径', origin, 400)
        }

      case 'PUT':
        // PUT /api/weight/{resource}/{id} - 更新项目
        if (!id) {
          return ApiResponse.error('更新项目需要提供ID', origin, 400)
        }
        const updateData = await request.json()
        if (resource === 'members') {
          return await this.controller.updateMember(id, updateData, user, origin)
        } else if (resource === 'records') {
          return await this.controller.updateRecord(id, updateData, user, origin)
        } else {
          return ApiResponse.error('无效的资源路径', origin, 400)
        }

      case 'DELETE':
        // DELETE /api/weight/{resource}/{id} - 删除项目
        if (!id) {
          return ApiResponse.error('删除项目需要提供ID', origin, 400)
        }
        if (resource === 'members') {
          return await this.controller.deleteMember(id, user, origin)
        } else if (resource === 'records') {
          return await this.controller.deleteRecord(id, user, origin)
        } else {
          return ApiResponse.error('无效的资源路径', origin, 400)
        }

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}
