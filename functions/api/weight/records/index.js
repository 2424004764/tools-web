import { ApiResponse, initDatabase } from '../../../utils/db.js'
import { WeightController } from '../../../controllers/weightController.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/weight/records', '')
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

    switch (request.method) {
      case 'GET':
        return await controller.getRecords(user, origin, queryParams)

      case 'POST':
        const createData = await request.json()
        return await controller.createRecord(createData, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  } catch (error) {
    console.error('Weight Records API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
