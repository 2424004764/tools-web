import { NotesController } from '../controllers/notesController.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse, Pager } from '../utils/db.js'

export class NotesRouter {
  constructor(db, env = null, waitUntil = null) {
    this.controller = new NotesController(db, env, waitUntil)
  }

  // 路由分发 - 添加认证检查
  async handle(request, path, env, origin) {
    // 提取用户信息
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    const user = authResult.user
    const hasGroupsPrefix = path === '/groups' || path.startsWith('/groups/')

    // 分组资源：/api/notes/groups 与 /api/notes/groups/{id}
    if (hasGroupsPrefix) {
      const groupId = path === '/groups' ? '' : path.replace('/groups/', '')
      return await this.handleGroup(request, user, groupId, origin)
    }

    // 笔记资源：/api/notes 与 /api/notes/{id}
    const id = path.substring(1)
    const hasId = path && path !== '/'

    switch (request.method) {
      case 'GET':
        if (!hasId) {
          // GET /api/notes - 获取当前用户的所有笔记（支持分页 + 分组过滤）
          const pager = Pager.fromRequest(request)
          return await this.controller.index(user, pager, request, origin)
        } else {
          // GET /api/notes/{id} - 根据ID获取当前用户的笔记
          return await this.controller.show(id, user, origin)
        }

      case 'POST':
        // POST /api/notes - 为当前用户创建笔记
        if (hasId) {
          return ApiResponse.error('创建笔记不需要提供ID', origin, 400)
        }
        const createData = await request.json()
        return await this.controller.store(createData, user, origin)

      case 'PUT':
        // PUT /api/notes/{id} - 更新当前用户的笔记
        if (!hasId) {
          return ApiResponse.error('更新笔记需要提供ID', origin, 400)
        }
        const updateData = await request.json()
        return await this.controller.update(id, updateData, user, origin)

      case 'DELETE':
        // DELETE /api/notes/{id} - 删除当前用户的笔记
        if (!hasId) {
          return ApiResponse.error('删除笔记需要提供ID', origin, 400)
        }
        return await this.controller.destroy(id, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }

  // 分组子路由分发
  async handleGroup(request, user, groupId, origin) {
    switch (request.method) {
      case 'GET':
        if (!groupId) {
          // GET /api/notes/groups - 列出当前用户所有分组（含计数）
          return await this.controller.getGroups(user, origin)
        }
        // GET /api/notes/groups/{id}
        return await this.controller.getGroup(groupId, user, origin)

      case 'POST':
        // POST /api/notes/groups - 创建分组
        if (groupId) {
          return ApiResponse.error('创建分组不需要提供ID', origin, 400)
        }
        const createData = await request.json()
        return await this.controller.createGroup(createData, user, origin)

      case 'PUT':
        // PUT /api/notes/groups/{id} - 更新分组
        if (!groupId) {
          return ApiResponse.error('更新分组需要提供ID', origin, 400)
        }
        const updateData = await request.json()
        return await this.controller.updateGroup(groupId, updateData, user, origin)

      case 'DELETE':
        // DELETE /api/notes/groups/{id} - 删除分组
        if (!groupId) {
          return ApiResponse.error('删除分组需要提供ID', origin, 400)
        }
        return await this.controller.deleteGroup(groupId, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  }
}