import { ApiResponse, initDatabase } from '../../utils/db.js'
import { FixedExpenseController } from '../../controllers/fixedExpenseController.js'
import { AuthMiddleware } from '../../middlewares/auth.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) return dbInit.response

  try {
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)

    const controller = new FixedExpenseController(dbInit.db)
    const user = authResult.user
    const id = url.pathname.split('/').pop()

    // 嗅探子路径：statistics / export 是集合级别的接口，不应作为 item id 处理
    // （Pages Functions 路由在同目录 [id].js 与 statistics/index.js 同时存在时，
    //   会优先匹配 [id].js，所以这里需要显式分流）
    if (id === 'statistics' && request.method === 'GET') {
      return await controller.getStatistics(user, origin)
    }
    if (id === 'export' && request.method === 'GET') {
      return await controller.exportData(user, origin)
    }

    switch (request.method) {
      case 'GET':
        return await controller.getItem(id, user, origin)

      case 'PUT':
        // eslint-disable-next-line no-case-declarations
        const updateData = await request.json()
        return await controller.update(id, updateData, user, origin)

      case 'DELETE':
        return await controller.delete(id, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  } catch (error) {
    console.error('Fixed Expense [id] API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
