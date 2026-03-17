import { ApiResponse, initDatabase } from '../../utils/db.js'
import { WeightController } from '../../controllers/weightController.js'
import { AuthMiddleware } from '../../middlewares/auth.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) {
    return dbInit.response
  }

  try {
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    const controller = new WeightController(dbInit.db)
    const user = authResult.user
    const queryParams = Object.fromEntries(url.searchParams)

    // 处理特殊路由: /api/weight/statistics, /api/weight/chart, /api/weight/export
    const path = url.pathname.replace('/api/weight', '')

    if (path === '/statistics' || path === '/statistics/') {
      return await controller.getStatistics(user, origin, queryParams)
    }

    if (path === '/chart' || path === '/chart/') {
      return await controller.getChartData(user, origin, queryParams)
    }

    if (path === '/export' || path === '/export/') {
      return await controller.exportData(user, origin)
    }

    return ApiResponse.error('无效的资源路径', origin, 400)
  } catch (error) {
    console.error('Weight API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
