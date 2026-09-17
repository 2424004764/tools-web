import { ApiResponse, initDatabase, QueryBuilder, ShoppingPurchaseHistoryModel } from '../../../utils/db.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'
export async function onRequest(context) {
  const { request, env } = context; const origin = request.headers.get('Origin'); if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  const init = initDatabase(env, context.waitUntil); if (!init.success) return init.response
  const auth = await AuthMiddleware.extractUserFromRequest(request, env); if (!auth.success) return AuthMiddleware.createAuthErrorResponse(auth.error, origin)
  if (request.method !== 'GET') return ApiResponse.error('仅支持 GET 请求', origin, 405)
  try { const url = new URL(request.url); const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 20))); const sql = `SELECT name, brand, category, unit, purchase_location AS purchaseLocation, COUNT(*) AS purchaseCount, MAX(purchased_at) AS lastPurchasedAt, AVG(actual_price) AS averagePrice FROM shopping_purchase_history WHERE uid = ? GROUP BY name, brand, category, unit, purchase_location ORDER BY purchaseCount DESC, lastPurchasedAt DESC LIMIT ${limit}`; const result = await init.db.prepare(sql).bind(auth.user.id).all(); return ApiResponse.success({ frequent: result.results || [], items: result.results || [], count: (result.results || []).length }, origin) } catch (e) { console.error(e); return ApiResponse.error('常买商品查询失败', origin, 500) }
}
export async function onRequestOptions(context) { return ApiResponse.cors(context.request.headers.get('Origin')) }
