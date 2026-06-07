import { ApiResponse, initDatabase } from '../../utils/db.js'
import { MockSchemasRouter } from '../../routes/mockSchemas.js'

export async function onRequest(context) {
  const { request, env, params } = context
  const url = new URL(request.url)
  const origin = request.headers.get('Origin')
  const path = `/${params.id}`

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) return dbInit.response

  try {
    const router = new MockSchemasRouter(dbInit.db)
    return await router.handle(request, path, env, origin)
  } catch (error) {
    console.error('MockSchemas API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
