import { ApiResponse, initDatabase, QueryBuilder, ShoppingPurchaseHistoryModel } from '../../../utils/db.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'
export async function onRequest(context) {
  const { request, env } = context; const origin = request.headers.get('Origin'); if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  const init = initDatabase(env, context.waitUntil); if (!init.success) return init.response
  const auth = await AuthMiddleware.extractUserFromRequest(request, env); if (!auth.success) return AuthMiddleware.createAuthErrorResponse(auth.error, origin)
  if (request.method !== 'GET') return ApiResponse.error('仅支持 GET 请求', origin, 405)
  try { const url = new URL(request.url); const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50))); const qb = new QueryBuilder().where('uid', '=', auth.user.id).orderBy('purchasedAt', 'DESC').limit(limit); const rows = await new ShoppingPurchaseHistoryModel(init.db, init.env, init.waitUntil).findAll(qb); return ApiResponse.success({ history: rows, items: rows, count: rows.length }, origin) } catch (e) { console.error(e); return ApiResponse.error('购买历史查询失败', origin, 500) }
}
export async function onRequestOptions(context) { return ApiResponse.cors(context.request.headers.get('Origin')) }
