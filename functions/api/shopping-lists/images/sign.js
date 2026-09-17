import { ApiResponse, initDatabase, QueryBuilder, ShoppingListModel } from '../../../utils/db.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'
import { buildR2PublicUrl, signR2PutUrl } from '../../../services/r2.js'

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024

export async function onRequest(context) {
  const { request, env } = context
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  if (request.method !== 'POST') return ApiResponse.error('不支持的请求方法', origin, 405)
  const init = initDatabase(env, context.waitUntil)
  if (!init.success) return init.response
  const auth = await AuthMiddleware.extractUserFromRequest(request, env)
  if (!auth.success) return AuthMiddleware.createAuthErrorResponse(auth.error, origin)
  try {
    const body = await request.json().catch(() => ({}))
    const listId = String(body?.listId || '').trim()
    const itemId = String(body?.itemId || '').trim()
    const contentType = String(body?.contentType || '').toLowerCase().trim()
    const size = Number(body?.size)
    if (!listId || !itemId) return ApiResponse.error('缺少清单或条目标识', origin, 400)
    if (!TYPES.has(contentType)) return ApiResponse.error('仅支持 JPG、PNG 或 WebP 图片', origin, 400)
    if (!Number.isInteger(size) || size <= 0 || size > MAX_BYTES) return ApiResponse.error('图片大小不能超过 5MB', origin, 400)
    const list = await new ShoppingListModel(init.db, init.env, init.waitUntil).findOne(new QueryBuilder().where('id', '=', listId).where('uid', '=', auth.user.id))
    if (!list) return ApiResponse.error('清单不存在或无权限', origin, 404)
    const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.slice('image/'.length)
    const r2Key = `shopping-list/${auth.user.id}/${listId}/${itemId}-${crypto.randomUUID()}.${extension}`
    const signed = await signR2PutUrl(env, env.R2_BUCKET_NAME, r2Key, contentType)
    const publicUrl = buildR2PublicUrl(env, r2Key)
    if (!publicUrl) return ApiResponse.error('图片公网地址未配置', origin, 503)
    return ApiResponse.success({ ...signed, publicUrl }, origin)
  } catch (error) {
    console.error('Shopping list image signing error:', error)
    return ApiResponse.error('图片上传服务暂不可用', origin, 503)
  }
}

export async function onRequestOptions(context) { return ApiResponse.cors(context.request.headers.get('Origin')) }
