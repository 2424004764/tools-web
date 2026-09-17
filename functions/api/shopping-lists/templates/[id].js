import { ApiResponse, initDatabase, QueryBuilder, ShoppingListTemplateModel, ShoppingListModel, ShoppingListItemModel } from '../../../utils/db.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'
function validateTemplate(body, update = false) {
  const data = {}; const errors = []
  if (!update || body?.name !== undefined) { const name = String(body?.name ?? '').trim(); if (!name || name.length > 100) errors.push('模板名称不能为空且不能超过100字符'); else data.name = name }
  for (const [key, max] of [['description', 500], ['purchaseMethod', 50], ['purchaseLocation', 100]]) if (body?.[key] !== undefined) { const value = body[key] == null ? null : String(body[key]).trim(); if (value && value.length > max) errors.push(`${key} 长度超限`); else data[key] = value || null }
  if (body?.budget !== undefined) { const value = body.budget == null ? null : Number(body.budget); if (value !== null && (!Number.isFinite(value) || value < 0)) errors.push('budget 必须是非负数字'); else data.budget = value }
  if (body?.items !== undefined) { if (!Array.isArray(body.items) || body.items.length > 1000) errors.push('items 必须是不超过1000项的数组'); else data.itemsJson = JSON.stringify(body.items) }
  return { data, errors }
}
function templateOutput(row) { let items = []; try { items = JSON.parse(row?.itemsJson || '[]') } catch { /* invalid stored JSON */ } return { ...row, items } }
export async function onRequest(context) {
  const { request, env } = context; const origin = request.headers.get('Origin'); if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  const init = initDatabase(env, context.waitUntil); if (!init.success) return init.response
  const auth = await AuthMiddleware.extractUserFromRequest(request, env); if (!auth.success) return AuthMiddleware.createAuthErrorResponse(auth.error, origin)
  const id = String(context.params?.id || '').trim(); if (!id) return ApiResponse.error('缺少模板id', origin, 400)
  const model = new ShoppingListTemplateModel(init.db, init.env, init.waitUntil)
  try {
    const row = await model.findOne(new QueryBuilder().where('id', '=', id).where('uid', '=', auth.user.id)); if (!row) return ApiResponse.error('模板不存在或无权限', origin, 404)
    if (request.method === 'GET') return ApiResponse.success(templateOutput(row), origin)
    if (request.method === 'PUT') { const v = validateTemplate(await request.json().catch(() => ({})), true); if (v.errors.length) return ApiResponse.error(v.errors.join('；'), origin, 400); if (!Object.keys(v.data).length) return ApiResponse.error('没有可更新的字段', origin, 400); await model.updateWithQuery(v.data, new QueryBuilder().where('id', '=', id).where('uid', '=', auth.user.id)); return ApiResponse.success(templateOutput(await model.findOne(new QueryBuilder().where('id', '=', id).where('uid', '=', auth.user.id))), origin) }
    if (request.method === 'DELETE') { await model.deleteWithQuery(new QueryBuilder().where('id', '=', id).where('uid', '=', auth.user.id)); return ApiResponse.success({ deleted: true }, origin) }
    if (request.method === 'POST') { const listId = crypto.randomUUID(); const listModel = new ShoppingListModel(init.db, init.env, init.waitUntil); const itemModel = new ShoppingListItemModel(init.db, init.env, init.waitUntil); await listModel.create({ id: listId, uid: auth.user.id, name: row.name, description: row.description, budget: row.budget, purchaseMethod: row.purchaseMethod, purchaseLocation: row.purchaseLocation, priority: row.priority, status: 0 }); const items = JSON.parse(row.itemsJson || '[]'); for (const item of items) { const copy = { ...item }; delete copy.id; await itemModel.create({ id: crypto.randomUUID(), listId, uid: auth.user.id, name: String(copy.name || '').trim(), quantity: Number(copy.quantity || 1), ...copy, checked: 0, isRequired: copy.isRequired ? 1 : 0 }) } return ApiResponse.success({ listId }, origin, 201) }
    return ApiResponse.error('不支持的请求方法', origin, 405)
  } catch (e) { console.error(e); return ApiResponse.error('模板操作失败', origin, 500) }
}
export async function onRequestOptions(context) { return ApiResponse.cors(context.request.headers.get('Origin')) }
