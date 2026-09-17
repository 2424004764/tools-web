import { ApiResponse, initDatabase, QueryBuilder, ShoppingListModel, ShoppingListItemModel, ShoppingPurchaseHistoryModel } from '../../../../utils/db.js'
import { AuthMiddleware } from '../../../../middlewares/auth.js'

function validate(body) {
  const data = {}; const errors = []
  for (const [key, max] of [['name', 100], ['unit', 30], ['brand', 80], ['category', 50], ['purchaseLocation', 100], ['actualWeight', 50], ['note', 500]]) if (body?.[key] !== undefined) { const v = body[key] == null ? null : String(body[key]).trim(); if (key === 'name' && !v) errors.push('商品名称不能为空'); else if (v && v.length > max) errors.push(`${key} 长度超限`); else data[key] = v || null }
  if (body?.quantity !== undefined || body?.actualQuantity !== undefined) for (const key of ['quantity', 'actualQuantity']) if (body?.[key] !== undefined) { const v = body[key] == null ? null : Number(body[key]); if (v !== null && (!Number.isFinite(v) || v <= 0 || v > 100000)) errors.push(`${key} 必须是0~100000的数字`); else data[key] = v }
  if (body?.priority !== undefined) { const v = Number(body.priority); if (!Number.isInteger(v) || v < 0 || v > 5) errors.push('priority 必须是0~5整数'); else data.priority = v }
  if (body?.isRequired !== undefined || body?.required !== undefined) { const v = body.isRequired ?? body.required; if (![true, false, 0, 1].includes(v)) errors.push('isRequired 必须是布尔值'); else data.isRequired = v ? 1 : 0 }
  if (body?.estimatedPrice !== undefined) { const v = body.estimatedPrice === null ? null : Number(body.estimatedPrice); if (v !== null && (!Number.isFinite(v) || v < 0)) errors.push('estimatedPrice 必须是非负数字'); else data.estimatedPrice = v }
  if (body?.actualPrice !== undefined) { const v = body.actualPrice === null ? null : Number(body.actualPrice); if (v !== null && (!Number.isFinite(v) || v < 0)) errors.push('actualPrice 必须是非负数字'); else data.actualPrice = v }
  if (body?.weight !== undefined) data.weight = body.weight == null ? null : String(body.weight).trim().slice(0, 50)
  if (body?.checked !== undefined) { if (![true, false, 0, 1].includes(body.checked)) errors.push('checked 必须是布尔值'); else data.checked = body.checked ? 1 : 0 }
  if (body?.imageUrl !== undefined) { const v = body.imageUrl == null ? null : String(body.imageUrl).trim(); if (v && (v.length > 1024 || !/^https:\/\//i.test(v))) errors.push('imageUrl 必须是 HTTPS 图片地址且不超过 1024 字符'); else data.imageUrl = v || null }
  return { data, errors }
}
export async function onRequest(context) {
  const { request, env } = context; const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  const init = initDatabase(env, context.waitUntil); if (!init.success) return init.response
  const auth = await AuthMiddleware.extractUserFromRequest(request, env); if (!auth.success) return AuthMiddleware.createAuthErrorResponse(auth.error, origin)
  const listId = (context.params?.id || '').trim(); const itemId = (context.params?.itemId || '').trim()
  if (!listId || !itemId) return ApiResponse.error('缺少路径参数', origin, 400)
  const listModel = new ShoppingListModel(init.db, init.env, init.waitUntil); const itemModel = new ShoppingListItemModel(init.db, init.env, init.waitUntil)
  try {
    const list = await listModel.findOne(new QueryBuilder().where('id', '=', listId).where('uid', '=', auth.user.id)); if (!list) return ApiResponse.error('清单不存在或无权限', origin, 404)
    const item = await itemModel.findOne(new QueryBuilder().where('id', '=', itemId).where('listId', '=', listId).where('uid', '=', auth.user.id)); if (!item) return ApiResponse.error('条目不存在或无权限', origin, 404)
    if (request.method === 'GET') return ApiResponse.success(item, origin)
    if (request.method === 'PUT') { const v = validate(await request.json().catch(() => ({}))); if (v.errors.length) return ApiResponse.error(v.errors.join('；'), origin, 400); if (!Object.keys(v.data).length) return ApiResponse.error('没有可更新的字段', origin, 400); const wasChecked = Number(item.checked) === 1; await itemModel.updateWithQuery(v.data, new QueryBuilder().where('id', '=', itemId).where('listId', '=', listId).where('uid', '=', auth.user.id)); if (v.data.checked === 1 && !wasChecked) { const key = `${itemId}:${v.data.purchasedAt || new Date().toISOString().slice(0, 10)}`; await init.db.prepare(`INSERT OR IGNORE INTO shopping_purchase_history (id, uid, list_id, item_id, purchase_key, name, brand, category, unit, quantity, weight, actual_quantity, actual_weight, actual_price, purchase_location, purchased_at) SELECT ?, uid, list_id, id, ?, name, brand, category, unit, quantity, weight, actual_quantity, actual_weight, actual_price, purchase_location, COALESCE(purchased_at, CURRENT_TIMESTAMP) FROM shopping_list_items WHERE id = ? AND list_id = ? AND uid = ?`).bind(crypto.randomUUID(), key, itemId, listId, auth.user.id).run() } await init.db.prepare('UPDATE shopping_lists SET update_time = CURRENT_TIMESTAMP WHERE id = ? AND uid = ?').bind(listId, auth.user.id).run(); return ApiResponse.success({ ...(await itemModel.findOne(new QueryBuilder().where('id', '=', itemId).where('uid', '=', auth.user.id))), purchased: Number(v.data.checked ?? item.checked) === 1 }, origin) }
    if (request.method === 'DELETE') { await itemModel.deleteWithQuery(new QueryBuilder().where('id', '=', itemId).where('listId', '=', listId).where('uid', '=', auth.user.id)); await init.db.prepare('UPDATE shopping_lists SET update_time = CURRENT_TIMESTAMP WHERE id = ? AND uid = ?').bind(listId, auth.user.id).run(); return ApiResponse.success({ deleted: true }, origin) }
    return ApiResponse.error('不支持的请求方法', origin, 405)
  } catch (error) { console.error('Shopping list item API error:', error); return ApiResponse.error('购物条目操作失败', origin, 500) }
}
export async function onRequestOptions(context) { return ApiResponse.cors(context.request.headers.get('Origin')) }
