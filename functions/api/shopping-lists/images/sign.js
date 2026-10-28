import { ApiResponse, initDatabase, QueryBuilder, ShoppingListModel } from '../../../utils/db.js'
import { AuthMiddleware } from '../../../middlewares/auth.js'
import { buildR2PublicUrl, signR2PutUrl } from '../../../services/r2.js'
import { reserveStorage, releaseReservation } from '../../../services/storageQuotaService.js'

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
    // 上传前预扣存储额度；额度不足（含未购买）返回 402 引导购买
    const reservationId = await reserveStorage(init.db, auth.user.id, size)
    if (!reservationId) {
      return ApiResponse.error('存储空间不足，请先在「积分」页购买存储额度（1 积分 = 100MB）', origin, 402)
    }
    const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.slice('image/'.length)
    const r2Key = `shopping-list/${auth.user.id}/${listId}/${itemId}-${crypto.randomUUID()}.${extension}`
    // content-length 与 content-type 都锁进签名：实际 PUT 字节数 / 类型与声明不符 → R2 直接 403。
    // 只预留不锁长度时，"声明 1 字节实际上传 1GB"会绕过配额计费。
    try {
      const signed = await signR2PutUrl(env, env.R2_BUCKET_NAME, r2Key, contentType, { contentLength: size })
      const publicUrl = buildR2PublicUrl(env, r2Key)
      if (!publicUrl) throw new Error('图片公网地址未配置')

      await init.db
        .prepare(
          `INSERT INTO shopping_list_image_uploads
             (r2_key, uid, reservation_id, declared_bytes, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
        )
        .bind(r2Key, auth.user.id, reservationId, size)
        .run()

      return ApiResponse.success({ ...signed, publicUrl, r2Key, reservationId }, origin)
    } catch (error) {
      await releaseReservation(init.db, auth.user.id, reservationId).catch(() => {})
      throw error
    }
  } catch (error) {
    console.error('Shopping list image signing error:', error)
    return ApiResponse.error('图片上传服务暂不可用', origin, 503)
  }
}

export async function onRequestOptions(context) { return ApiResponse.cors(context.request.headers.get('Origin')) }
