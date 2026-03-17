import { ApiResponse, initDatabase } from '../../../utils/db.js'
import { WeightController } from '../../../controllers/weightController.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'

export async function onRequest(context) {
  const { request, env } = context
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
    const url = new URL(request.url)
    const id = url.pathname.split('/').pop()

    switch (request.method) {
      case 'GET':
        return await controller.getMember(id, user, origin)

      case 'PUT':
        const updateData = await request.json()
        return await controller.updateMember(id, updateData, user, origin)

      case 'DELETE':
        return await controller.deleteMember(id, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  } catch (error) {
    console.error('Weight Member [id] API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
