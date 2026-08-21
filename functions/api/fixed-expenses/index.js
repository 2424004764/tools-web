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
    const queryParams = Object.fromEntries(url.searchParams)
    const path = url.pathname.replace('/api/fixed-expenses', '')

    // 子路径：statistics / export
    if (path === '/statistics' || path === '/statistics/') {
      return await controller.getStatistics(user, origin)
    }
    if (path === '/export' || path === '/export/') {
      return await controller.exportData(user, origin)
    }

    switch (request.method) {
      case 'GET':
        return await controller.getList(user, origin, queryParams)

      case 'POST':
        // eslint-disable-next-line no-case-declarations
        const createData = await request.json()
        return await controller.create(createData, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  } catch (error) {
    console.error('Fixed Expenses API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
