import { ApiResponse, initDatabase } from '../../utils/db.js'
import { TravelMapsService } from '../../services/travelMapsService.js'

// 公开只读的分享地图 —— 无需登录
//   GET /api/travel-map/{slug}
// 只有 is_public = 1 的地图可读；关闭分享后该链接立即失效。
export async function onRequest(context) {
  const { request, env, params } = context
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }
  if (request.method !== 'GET') {
    return ApiResponse.error('不支持的请求方法', origin, 405)
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) {
    return dbInit.response
  }

  try {
    const slug = params.slug
    if (!slug) return ApiResponse.error('缺少 slug 参数', origin, 400)

    const service = new TravelMapsService(dbInit.db)
    const data = await service.getPublicBySlug(slug)
    if (!data) return ApiResponse.error('地图不存在或已取消分享', origin, 404)

    return ApiResponse.success(data, origin)
  } catch (error) {
    console.error('TravelMap share API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
