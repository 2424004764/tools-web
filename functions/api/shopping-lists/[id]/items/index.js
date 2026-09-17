import { ApiResponse, initDatabase, QueryBuilder, ShoppingListModel, ShoppingListItemModel, ShoppingPurchaseHistoryModel } from '../../../../utils/db.js'
import { AuthMiddleware } from '../../../../middlewares/auth.js'

function validate(body) {
  const data = {}; const errors = []
  const name = String(body?.name ?? '').trim(); if (!name) errors.push('商品名称不能为空'); else if (name.length > 100) errors.push('商品名称不能超过 100 字符'); else data.name = name
  const quantity = body?.quantity === undefined ? 1 : Number(body.quantity); if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) errors.push('quantity 必须是 0~100000 的数字'); else data.quantity = quantity
  if (body?.unit !== undefined) { const unit = body.unit == null ? null : String(body.unit).trim(); if (unit && unit.length > 30) errors.push('单位不能超过 30 字符'); else data.unit = unit || null }
  if (body?.estimatedPrice !== undefined && body.estimatedPrice !== null) { const p = Number(body.estimatedPrice); if (!Number.isFinite(p) || p < 0 || p > 100000000) errors.push('estimatedPrice 必须是非负数字'); else data.estimatedPrice = p } else if (body?.estimatedPrice === null) data.estimatedPrice = null
  if (body?.actualPrice !== undefined && body.actualPrice !== null) { const p = Number(body.actualPrice); if (!Number.isFinite(p) || p < 0 || p > 100000000) errors.push('actualPrice 必须是非负数字'); else data.actualPrice = p } else if (body?.actualPrice === null) data.actualPrice = null
  if (body?.brand !== undefined) { const v = body.brand == null ? null : String(body.brand).trim(); if (v && v.length > 80) errors.push('brand 长度超限'); else data.brand = v || null }
  if (body?.purchaseLocation !== undefined) { const v = body.purchaseLocation == null ? null : String(body.purchaseLocation).trim(); if (v && v.length > 100) errors.push('purchaseLocation 长度超限'); else data.purchaseLocation = v || null }
  if (body?.priority !== undefined) { const v = Number(body.priority); if (!Number.isInteger(v) || v < 0 || v > 5) errors.push('priority 必须是0~5整数'); else data.priority = v }
  if (body?.isRequired !== undefined || body?.required !== undefined) { const v = body.isRequired ?? body.required; if (![true, false, 0, 1].includes(v)) errors.push('isRequired 必须是布尔值'); else data.isRequired = v ? 1 : 0 }
  if (body?.actualQuantity !== undefined) { const v = body.actualQuantity == null ? null : Number(body.actualQuantity); if (v !== null && (!Number.isFinite(v) || v <= 0)) errors.push('actualQuantity 必须是正数'); else data.actualQuantity = v }
  if (body?.actualWeight !== undefined) data.actualWeight = body.actualWeight == null ? null : String(body.actualWeight).trim().slice(0, 50)
  if (body?.weight !== undefined) data.weight = body.weight == null ? null : String(body.weight).trim().slice(0, 50)
  for (const key of ['category', 'note']) if (body?.[key] !== undefined) { const value = body[key] == null ? null : String(body[key]).trim(); if (value && value.length > (key === 'note' ? 500 : 50)) errors.push(`${key} 长度超限`); else data[key] = value || null }
  if (body?.imageUrl !== undefined) { const v = body.imageUrl == null ? null : String(body.imageUrl).trim(); if (v && (v.length > 1024 || !/^https:\/\//i.test(v))) errors.push('imageUrl 必须是 HTTPS 图片地址且不超过 1024 字符'); else data.imageUrl = v || null }
  if (body?.checked !== undefined || body?.purchased !== undefined) { const v = body.checked ?? body.purchased; if (![true, false, 0, 1].includes(v)) errors.push('checked 必须是布尔值'); else data.checked = v ? 1 : 0 }
  return { data, errors }
}
export async function onRequest(context) {
  const { request, env } = context; const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  const init = initDatabase(env, context.waitUntil); if (!init.success) return init.response
  const auth = await AuthMiddleware.extractUserFromRequest(request, env); if (!auth.success) return AuthMiddleware.createAuthErrorResponse(auth.error, origin)
  const listId = (context.params?.id || '').trim(); if (!listId) return ApiResponse.error('缺少清单 id', origin, 400)
  const list = await new ShoppingListModel(init.db, init.env, init.waitUntil).findOne(new QueryBuilder().where('id', '=', listId).where('uid', '=', auth.user.id))
  if (!list) return ApiResponse.error('清单不存在或无权限', origin, 404)
  const model = new ShoppingListItemModel(init.db, init.env, init.waitUntil)
  try {
    if (request.method === 'GET') {
      const items = await model.findAll(new QueryBuilder().where('listId', '=', listId).where('uid', '=', auth.user.id).orderBy('checked', 'ASC').orderBy('updateTime', 'DESC'))
      return ApiResponse.success({ items, count: items.length }, origin)
    }
    if (request.method === 'POST') {
      const v = validate(await request.json().catch(() => ({}))); if (v.errors.length) return ApiResponse.error(v.errors.join('；'), origin, 400)
      const id = crypto.randomUUID(); await model.create({ id, listId, uid: auth.user.id, checked: 0, ...v.data })
      await init.db.prepare('UPDATE shopping_lists SET update_time = CURRENT_TIMESTAMP WHERE id = ? AND uid = ?').bind(listId, auth.user.id).run()
      const item = await model.findOne(new QueryBuilder().where('id', '=', id).where('listId', '=', listId).where('uid', '=', auth.user.id))
      return ApiResponse.success(item, origin, 201)
    }
    return ApiResponse.error('不支持的请求方法', origin, 405)
  } catch (error) { console.error('Shopping list items API error:', error); return ApiResponse.error('购物条目操作失败', origin, 500) }
}
export async function onRequestOptions(context) { return ApiResponse.cors(context.request.headers.get('Origin')) }
