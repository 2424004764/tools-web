import { initDatabase } from '../../utils/db.js'
import { PasswordController } from '../../controllers/passwordController.js'
import { AuthMiddleware } from '../../middlewares/auth.js'
import { ApiResponse } from '../../utils/db.js'

export async function onRequest(context) {
  const { request, env, params } = context
  const url = new URL(request.url)
  const origin = request.headers.get('Origin')

  // 处理OPTIONS请求
  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  // 初始化数据库
  const dbInit = initDatabase(env)
  if (!dbInit.success) {
    return dbInit.response
  }

  // 提取用户信息
  const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
  if (!authResult.success) {
    return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
  }

  const user = authResult.user
  const id = params.id

  try {
    const controller = new PasswordController(dbInit.db)

    switch (request.method) {
      case 'GET':
        return await controller.getEntry(id, user, origin)

      case 'PUT':
        const updateData = await request.json()
        return await controller.updateEntry(id, updateData, user, origin)

      case 'DELETE':
        return await controller.deleteEntry(id, user, origin)

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  } catch (error) {
    console.error('Password entry API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
