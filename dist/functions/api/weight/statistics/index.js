import { ApiResponse, initDatabase } from '../../../utils/db.js'
import { WeightController } from '../../../controllers/weightController.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'

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
    const queryParams = Object.fromEntries(url.searchParams)
    return await controller.getStatistics(authResult.user, origin, queryParams)
  } catch (error) {
    console.error('Weight Statistics API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
