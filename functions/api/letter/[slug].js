import { ApiResponse, initDatabase } from '../../utils/db.js'
import { LettersService } from '../../services/lettersService.js'

export async function onRequest(context) {
  const { request, env, params } = context
  const origin = request.headers.get('Origin')

  // 处理OPTIONS请求
  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  // 仅支持 GET 请求
  if (request.method !== 'GET') {
    return ApiResponse.error('不支持的请求方法', origin, 405)
  }

  // 初始化数据库
  const dbInit = initDatabase(env)
  if (!dbInit.success) {
    return dbInit.response
  }

  try {
    const slug = params.slug
    if (!slug) {
      return ApiResponse.error('缺少 slug 参数', origin, 400)
    }

    const lettersService = new LettersService(dbInit.db)
    const result = await lettersService.getLetterBySlug(slug)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 404)
    }

    return ApiResponse.success(result.data, origin)
  } catch (error) {
    console.error('Letter API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
