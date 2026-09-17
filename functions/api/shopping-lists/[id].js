import { ApiResponse, initDatabase, QueryBuilder, ShoppingListModel, ShoppingListItemModel } from '../../utils/db.js'
import { AuthMiddleware } from '../../middlewares/auth.js'

const MAX_NAME = 100
const MAX_NOTE = 500
function validate(body) {
  const data = {}; const errors = []
  if (body?.name !== undefined) { const name = String(body.name).trim(); if (!name || name.length > MAX_NAME) errors.push('清单名称不能为空且不能超过 100 字符'); else data.name = name }
  if (body?.note !== undefined) { const note = body.note == null ? null : String(body.note).trim(); if (note && note.length > MAX_NOTE) errors.push('备注不能超过 500 字符'); else data.note = note || null }
  if (body?.budget !== undefined) { const v = body.budget == null ? null : Number(body.budget); if (v !== null && (!Number.isFinite(v) || v < 0)) errors.push('budget 必须是非负数字'); else data.budget = v }
  for (const [key, max] of [['purchaseMethod', 50], ['purchaseLocation', 100]]) if (body?.[key] !== undefined) { const v = body[key] == null ? null : String(body[key]).trim(); if (v && v.length > max) errors.push(`${key} 长度超限`); else data[key] = v || null }
  if (body?.priority !== undefined) { const v = Number(body.priority); if (!Number.isInteger(v) || v < 0 || v > 5) errors.push('priority 必须是0~5整数'); else data.priority = v }
  if (body?.status !== undefined) { const status = Number(body.status); if (!Number.isInteger(status) || ![0, 1, 2].includes(status)) errors.push('status 必须是 0、1 或 2'); else data.status = status }
  return { data, errors }
}
async function detail(db, env, waitUntil, uid, list) {
  const items = await new ShoppingListItemModel(db, env, waitUntil).findAll(new QueryBuilder().where('listId', '=', list.id).where('uid', '=', uid).orderBy('checked', 'ASC').orderBy('updateTime', 'DESC'))
  const checked = items.filter(i => Number(i.checked) === 1).length
  const mappedItems = items.map(item => ({ ...item, purchased: Number(item.checked) === 1 }))
  const estimatedTotal = Number(items.reduce((s, i) => s + Number(i.estimatedPrice || 0) * Number(i.quantity || 0), 0).toFixed(2))
  const actualTotal = Number(items.reduce((s, i) => s + Number(i.actualPrice || 0) * Number(i.quantity || 0), 0).toFixed(2))
  return { ...list, archived: Number(list.status) === 1, items: mappedItems, summary: { totalItems: items.length, checkedItems: checked, uncheckedItems: items.length - checked, estimatedTotal, actualTotal } }
}
export async function onRequest(context) {
  const { request, env } = context; const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  const init = initDatabase(env, context.waitUntil); if (!init.success) return init.response
  const auth = await AuthMiddleware.extractUserFromRequest(request, env); if (!auth.success) return AuthMiddleware.createAuthErrorResponse(auth.error, origin)
  const id = (context.params?.id || '').trim(); if (!id) return ApiResponse.error('缺少清单 id', origin, 400)
  const model = new ShoppingListModel(init.db, init.env, init.waitUntil)
  try {
    const list = await model.findOne(new QueryBuilder().where('id', '=', id).where('uid', '=', auth.user.id))
    if (!list) return ApiResponse.error('清单不存在或无权限', origin, 404)
    if (request.method === 'GET') return ApiResponse.success(await detail(init.db, init.env, init.waitUntil, auth.user.id, list), origin)
    if (request.method === 'PUT') {
      const v = validate(await request.json().catch(() => ({}))); if (v.errors.length) return ApiResponse.error(v.errors.join('；'), origin, 400)
      if (!Object.keys(v.data).length) return ApiResponse.error('没有可更新的字段', origin, 400)
      await model.updateWithQuery(v.data, new QueryBuilder().where('id', '=', id).where('uid', '=', auth.user.id))
      const updated = await model.findOne(new QueryBuilder().where('id', '=', id).where('uid', '=', auth.user.id))
      return ApiResponse.success(await detail(init.db, init.env, init.waitUntil, auth.user.id, updated), origin)
    }
    if (request.method === 'DELETE') {
      await new ShoppingListItemModel(init.db, init.env, init.waitUntil).deleteWithQuery(new QueryBuilder().where('listId', '=', id).where('uid', '=', auth.user.id))
      await model.deleteWithQuery(new QueryBuilder().where('id', '=', id).where('uid', '=', auth.user.id))
      return ApiResponse.success({ deleted: true }, origin)
    }
    return ApiResponse.error('不支持的请求方法', origin, 405)
  } catch (error) { console.error('Shopping list API error:', error); return ApiResponse.error('购物清单操作失败', origin, 500) }
}
export async function onRequestOptions(context) { return ApiResponse.cors(context.request.headers.get('Origin')) }
