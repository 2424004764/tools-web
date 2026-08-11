import { ApiResponse, initDatabase, Pager } from '../utils/db.js'
import { AuthMiddleware } from '../middlewares/auth.js'
import { TravelMapsService, ValidationError } from '../services/travelMapsService.js'

// 旅游地图 —— 登录用户的私有 CRUD
//   GET    /api/travel-maps        我的地图列表（分页）
//   POST   /api/travel-maps        新建地图
//   GET    /api/travel-maps/{id}   地图详情（含点位与路线）
//   PUT    /api/travel-maps/{id}   全量保存
//   DELETE /api/travel-maps/{id}   删除（级联点位与路线）
export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/travel-maps', '')
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) {
    return dbInit.response
  }

  // 全部接口都需要登录
  const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
  if (!authResult.success) {
    return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
  }
  const uid = authResult.user.id
  const id = path.replace(/^\//, '').trim()

  try {
    const service = new TravelMapsService(dbInit.db)

    switch (request.method) {
      case 'GET': {
        if (!id) {
          const pager = Pager.fromRequest(request, 20)
          // Pager 不限制上界，这里兜一层避免被要求一次拉全表
          pager.pageSize = Math.min(pager.pageSize, 50)
          const { list, total } = await service.listMyMaps(uid, pager.page, pager.pageSize)
          return ApiResponse.success(pager.createResult(list, total), origin)
        }
        const detail = await service.getMapForOwner(id, uid)
        if (!detail) return ApiResponse.error('地图不存在', origin, 404)
        return ApiResponse.success(detail, origin)
      }

      case 'POST': {
        if (id) return ApiResponse.error('不支持的请求路径', origin, 404)
        const body = await request.json().catch(() => ({}))
        const created = await service.createMap(uid, body)
        return ApiResponse.success(created, origin, 201)
      }

      case 'PUT': {
        if (!id) return ApiResponse.error('缺少地图 ID', origin, 400)
        const body = await request.json().catch(() => ({}))
        const saved = await service.saveMap(id, uid, body)
        if (!saved) return ApiResponse.error('地图不存在', origin, 404)
        return ApiResponse.success(saved, origin)
      }

      case 'DELETE': {
        if (!id) return ApiResponse.error('缺少地图 ID', origin, 400)
        const ok = await service.deleteMap(id, uid)
        if (!ok) return ApiResponse.error('地图不存在', origin, 404)
        return ApiResponse.success({ success: true }, origin)
      }

      default:
        return ApiResponse.error('不支持的请求方法', origin, 405)
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return ApiResponse.error(error.message, origin, 400)
    }
    console.error('TravelMaps API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
