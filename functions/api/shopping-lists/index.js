import { ApiResponse, initDatabase, QueryBuilder, ShoppingListModel, ShoppingListItemModel } from '../../utils/db.js'
import { AuthMiddleware } from '../../middlewares/auth.js'

const MAX_NAME = 100
const MAX_NOTE = 500
const headers = (origin) => ({ 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}) })

function validateList(body, update = false) {
  const data = {}
  const errors = []
  if (!update || body?.name !== undefined) {
    const name = String(body?.name ?? '').trim()
    if (!name) errors.push('清单名称不能为空')
    else if (name.length > MAX_NAME) errors.push(`清单名称不能超过 ${MAX_NAME} 字符`)
    else data.name = name
  }
  if (body?.note !== undefined) {
    const note = body.note == null ? null : String(body.note).trim()
    if (note && note.length > MAX_NOTE) errors.push(`备注不能超过 ${MAX_NOTE} 字符`)
    data.note = note || null
  }
  if (body?.budget !== undefined) { const v = body.budget == null ? null : Number(body.budget); if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100000000)) errors.push('budget 必须是非负数字'); else data.budget = v }
  for (const [key, max] of [['purchaseMethod', 50], ['purchaseLocation', 100]]) if (body?.[key] !== undefined) { const v = body[key] == null ? null : String(body[key]).trim(); if (v && v.length > max) errors.push(`${key} 长度超限`); else data[key] = v || null }
  if (body?.priority !== undefined) { const v = Number(body.priority); if (!Number.isInteger(v) || v < 0 || v > 5) errors.push('priority 必须是0~5整数'); else data.priority = v }
  if (body?.status !== undefined) {
    const status = Number(body.status)
    if (!Number.isInteger(status) || ![0, 1, 2].includes(status)) errors.push('status 必须是 0、1 或 2')
    else data.status = status
  }
  return { data, errors }
}

async function listData(db, env, waitUntil, uid, list) {
  const itemModel = new ShoppingListItemModel(db, env, waitUntil)
  const items = await itemModel.findAll(new QueryBuilder().where('listId', '=', list.id).where('uid', '=', uid).orderBy('checked', 'ASC').orderBy('updateTime', 'DESC'))
  const checkedCount = items.filter(item => Number(item.checked) === 1).length
  const mappedItems = items.map(item => ({ ...item, purchased: Number(item.checked) === 1 }))
  const estimatedTotal = Number(items.reduce((sum, item) => sum + (Number(item.estimatedPrice || 0) * Number(item.quantity || 0)), 0).toFixed(2))
  const actualTotal = Number(items.reduce((sum, item) => sum + (Number(item.actualPrice || 0) * Number(item.quantity || 0)), 0).toFixed(2))
  return { ...list, archived: Number(list.status) === 1, items: mappedItems, summary: { totalItems: items.length, checkedItems: checkedCount, uncheckedItems: items.length - checkedCount, estimatedTotal, actualTotal } }
}

export async function onRequest(context) {
  const { request, env } = context
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  const dbInit = initDatabase(env, context.waitUntil)
  if (!dbInit.success) return dbInit.response
  const auth = await AuthMiddleware.extractUserFromRequest(request, env)
  if (!auth.success) return AuthMiddleware.createAuthErrorResponse(auth.error, origin)
  const { db } = dbInit
  const model = new ShoppingListModel(db, dbInit.env, dbInit.waitUntil)
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const status = url.searchParams.get('status')
      const qb = new QueryBuilder().where('uid', '=', auth.user.id).orderBy('updateTime', 'DESC')
      if (status !== null && status !== '') {
        const value = Number(status)
        if (!Number.isInteger(value) || ![0, 1, 2].includes(value)) return ApiResponse.error('status 参数无效', origin, 400)
        qb.where('status', '=', value)
      }
      const lists = await model.findAll(qb)
      const data = []
      for (const list of lists) data.push(await listData(db, dbInit.env, dbInit.waitUntil, auth.user.id, list))
      return ApiResponse.success({ lists: data, items: data, count: data.length }, origin)
    }
    if (request.method === 'PUT') {
      const body = await request.json().catch(() => ({}))
      if (!Array.isArray(body?.lists)) return ApiResponse.error('lists 必须是数组', origin, 400)
      const itemModel = new ShoppingListItemModel(db, dbInit.env, dbInit.waitUntil)
      for (const incoming of body.lists.slice(0, 100)) {
        const listId = String(incoming?.id || crypto.randomUUID())
        const existing = await model.findOne(new QueryBuilder().where('id', '=', listId).where('uid', '=', auth.user.id))
        const listInput = { name: String(incoming?.name || '未命名清单').trim().slice(0, MAX_NAME) || '未命名清单', note: incoming?.note == null ? null : String(incoming.note).slice(0, MAX_NOTE), budget: incoming?.budget == null ? null : Number(incoming.budget), purchaseMethod: incoming?.purchaseMethod ?? incoming?.method ?? null, purchaseLocation: incoming?.purchaseLocation ?? incoming?.location ?? null, priority: Number(incoming?.priority || 0), status: incoming?.archived ? 1 : 0 }
        if (existing) await model.updateWithQuery(listInput, new QueryBuilder().where('id', '=', listId).where('uid', '=', auth.user.id))
        else await model.create({ id: listId, uid: auth.user.id, ...listInput })
        await itemModel.deleteWithQuery(new QueryBuilder().where('listId', '=', listId).where('uid', '=', auth.user.id))
        for (const item of Array.isArray(incoming?.items) ? incoming.items.slice(0, 1000) : []) {
          const imageUrl = item?.imageUrl == null ? null : String(item.imageUrl).trim()
          if (imageUrl && (imageUrl.length > 1024 || !/^https:\/\//i.test(imageUrl))) throw new Error('imageUrl 必须是 HTTPS 图片地址且不超过 1024 字符')
          await itemModel.create({ id: String(item?.id || crypto.randomUUID()), listId, uid: auth.user.id, name: String(item?.name || '未命名商品').trim().slice(0, 100) || '未命名商品', quantity: Number(item?.quantity || 1), unit: item?.unit ? String(item.unit).slice(0, 30) : null, weight: item?.weight ? String(item.weight).slice(0, 50) : null, brand: item?.brand ? String(item.brand).slice(0, 80) : null, imageUrl: imageUrl || null, purchaseLocation: item?.purchaseLocation ?? item?.location ?? null, priority: Number(item?.priority || 0), isRequired: item?.isRequired ?? item?.required ? 1 : 0, actualQuantity: item?.actualQuantity == null ? null : Number(item.actualQuantity), actualWeight: item?.actualWeight ?? null, estimatedPrice: Number(item?.estimatedPrice || 0), actualPrice: Number(item?.actualPrice || 0), category: item?.category ? String(item.category).slice(0, 50) : null, note: item?.note ? String(item.note).slice(0, 500) : null, checked: item?.purchased || item?.checked ? 1 : 0, purchasedAt: item?.purchased || item?.checked ? new Date().toISOString() : null })
        }
      }
      const lists = []
      for (const list of await model.findAll(new QueryBuilder().where('uid', '=', auth.user.id).orderBy('updateTime', 'DESC'))) lists.push(await listData(db, dbInit.env, dbInit.waitUntil, auth.user.id, list))
      return ApiResponse.success({ lists, count: lists.length }, origin)
    }
    if (request.method === 'POST') {
      const result = validateList(await request.json().catch(() => ({})))
      if (result.errors.length) return ApiResponse.error(result.errors.join('；'), origin, 400)
      const created = await model.create({ id: crypto.randomUUID(), uid: auth.user.id, status: 0, ...result.data })
      const list = await model.findOne(new QueryBuilder().where('id', '=', created.id).where('uid', '=', auth.user.id))
      return ApiResponse.success(await listData(db, dbInit.env, dbInit.waitUntil, auth.user.id, list), origin, 201)
    }
    return ApiResponse.error('不支持的请求方法', origin, 405)
  } catch (error) {
    console.error('Shopping lists API error:', error)
    return ApiResponse.error('购物清单操作失败', origin, 500)
  }
}

export async function onRequestOptions(context) { return ApiResponse.cors(context.request.headers.get('Origin')) }
