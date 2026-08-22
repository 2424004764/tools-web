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
    // 注：/api/fixed-expenses/statistics 与 /api/fixed-expenses/export 由各自子目录中的 index.js 处理，
    // 因为同级的 [id].js 在 Cloudflare Pages 路由中会优先匹配单段路径。

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
