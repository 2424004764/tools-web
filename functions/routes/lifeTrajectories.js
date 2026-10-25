import { AuthMiddleware } from '../middlewares/auth.js'
import { ApiResponse } from '../utils/db.js'
import { LifeTrajectoriesController } from '../controllers/lifeTrajectoriesController.js'

// 解析 JSON body：非法 JSON / 非 JSON 对象 → 400 响应（裸 request.json() 会炸成 500）
async function parseJsonBody(request, origin) {
  try {
    const data = await request.json()
    if (data !== null && typeof data === 'object') return { data }
    return { error: ApiResponse.error('请求体必须是 JSON 对象', origin, 400) }
  } catch {
    return { error: ApiResponse.error('请求体不是合法的 JSON', origin, 400) }
  }
}

export class LifeTrajectoriesRouter {
  constructor(db, env = null, waitUntil = null) {
    this.controller = new LifeTrajectoriesController(db, env, waitUntil)
  }

  // 轨迹是私密数据，所有方法（含 GET）都必须登录，且只能访问自己的：
  //   GET            → 自己的列表
  //   POST           → 发布
  //   PUT /:id       → 更新，仅自己的
  //   DELETE /:id    → 删除，仅自己的
  async handle(request, path, env, origin) {
    const method = request.method

    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }
    const user = authResult.user

    if (method === 'GET') {
      return await this.controller.index(request, user, origin)
    }

    if (method === 'POST') {
      const parsed = await parseJsonBody(request, origin)
      if (parsed.error) return parsed.error
      return await this.controller.store(parsed.data, user, origin)
    }

    if (method === 'PUT') {
      const id = path.replace(/^\//, '').trim()
      const parsed = await parseJsonBody(request, origin)
      if (parsed.error) return parsed.error
      return await this.controller.update(id, parsed.data, user, origin)
    }

    if (method === 'DELETE') {
      const id = path.replace(/^\//, '').trim()
      return await this.controller.destroy(id, user, origin)
    }

    return ApiResponse.error('不支持的请求方法', origin, 405)
  }
}
