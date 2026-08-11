import { ApiResponse, initDatabase, Pager } from '../utils/db.js'
import { TravelMapsService } from '../services/travelMapsService.js'

// 地图广场 —— 公开列表，无需登录
//   GET /api/travel-map-plaza?page=&pageSize=
export async function onRequest(context) {
  const { request, env } = context
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
    const pager = Pager.fromRequest(request, 12)
    // Pager 不限制上界，这里兜一层避免被要求一次拉全表
    pager.pageSize = Math.min(pager.pageSize, 48)
    const service = new TravelMapsService(dbInit.db)
    const { list, total } = await service.listPlaza(pager.page, pager.pageSize)
    return ApiResponse.success(pager.createResult(list, total), origin)
  } catch (error) {
    console.error('TravelMapPlaza API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
