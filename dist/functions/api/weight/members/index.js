import { ApiResponse, initDatabase } from '../../../utils/db.js'
import { WeightController } from '../../../controllers/weightController.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/weight/members', '')
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
    const id = path.substring(1)
    const hasId = id && id !== ''

    switch (request.method) {
      case 'GET':
        if (!hasId) {
          return await controller.getMembers(user, origin)
        } else {
          return await controller.getMember(id, user, origin)
        }

      case 'POST':
        if (hasId) {
          return ApiResponse.error('创建成员不需要提供ID', origin, 400)
        }
        const createData = await request.json()
        return await controller.createMember(createData, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  } catch (error) {
    console.error('Weight Members API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
