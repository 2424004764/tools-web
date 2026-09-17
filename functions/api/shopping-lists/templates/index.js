import { ApiResponse, initDatabase, QueryBuilder, ShoppingListTemplateModel } from '../../../utils/db.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'

const MAX = 100
function validate(body, update = false) {
  const data = {}; const errors = []
  if (!update || body?.name !== undefined) { const v = String(body?.name ?? '').trim(); if (!v || v.length > MAX) errors.push('模板名称不能为空且不能超过100字符'); else data.name = v }
  for (const [key, max] of [['description', 500], ['purchaseMethod', 50], ['purchaseLocation', 100]]) if (body?.[key] !== undefined) { const v = body[key] == null ? null : String(body[key]).trim(); if (v && v.length > max) errors.push(`${key} 长度超限`); else data[key] = v || null }
  if (body?.budget !== undefined) { const v = body.budget == null ? null : Number(body.budget); if (v !== null && (!Number.isFinite(v) || v < 0)) errors.push('budget 必须是非负数字'); else data.budget = v }
  if (body?.priority !== undefined) { const v = Number(body.priority); if (!Number.isInteger(v) || v < 0 || v > 5) errors.push('priority 必须是0~5整数'); else data.priority = v }
  if (body?.items !== undefined) { if (!Array.isArray(body.items) || body.items.length > 1000) errors.push('items 必须是不超过1000项的数组'); else data.itemsJson = JSON.stringify(body.items) }
  return { data, errors }
}
function output(row) { let items = []; try { items = JSON.parse(row.itemsJson || '[]') } catch {} return { ...row, items } }
export async function onRequest(context) {
  const { request, env } = context; const origin = request.headers.get('Origin'); if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  const init = initDatabase(env, context.waitUntil); if (!init.success) return init.response
  const auth = await AuthMiddleware.extractUserFromRequest(request, env); if (!auth.success) return AuthMiddleware.createAuthErrorResponse(auth.error, origin)
  const model = new ShoppingListTemplateModel(init.db, init.env, init.waitUntil)
  try {
    if (request.method === 'GET') { const rows = await model.findAll(new QueryBuilder().where('uid', '=', auth.user.id).orderBy('updateTime', 'DESC')); return ApiResponse.success({ templates: rows.map(output), count: rows.length }, origin) }
    if (request.method === 'POST') { const v = validate(await request.json().catch(() => ({}))); if (v.errors.length) return ApiResponse.error(v.errors.join('；'), origin, 400); const id = crypto.randomUUID(); await model.create({ id, uid: auth.user.id, itemsJson: '[]', priority: 0, ...v.data }); return ApiResponse.success(output(await model.findOne(new QueryBuilder().where('id', '=', id).where('uid', '=', auth.user.id))), origin, 201) }
    return ApiResponse.error('不支持的请求方法', origin, 405)
  } catch (e) { console.error(e); return ApiResponse.error('模板操作失败', origin, 500) }
}
export async function onRequestOptions(context) { return ApiResponse.cors(context.request.headers.get('Origin')) }
export { validate, output }
