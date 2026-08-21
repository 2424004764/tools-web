import { ApiResponse, initDatabase } from '../../../utils/db.js'
import { HeightController } from '../../../controllers/heightController.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'

export async function onRequest(context) {
  const { request, env } = context
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) return dbInit.response

  try {
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)

    const controller = new HeightController(dbInit.db)
    return await controller.exportData(authResult.user, origin)
  } catch (error) {
    console.error('Height Export API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}