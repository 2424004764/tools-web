// 阿里云 OSS 配置 - 单条操作
// GET    /api/oss-configs/:id    获取单条（脱敏）
// PUT    /api/oss-configs/:id    更新（密钥不传则保留）
// DELETE /api/oss-configs/:id    删除
import { AuthMiddleware } from '../../middlewares/auth.js'
import { OssService } from '../../services/ossService.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function onRequest(context) {
  const { request, env, params } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env.DB
  if (!db) {
    return new Response(JSON.stringify({ success: false, error: '数据库未配置' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }

  const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
  if (!authResult.success) {
    return AuthMiddleware.createAuthErrorResponse(authResult.error, '*', 401)
  }
  const uid = authResult.user.id

  // 从路由参数取 id
  const id = params?.id
  if (!id) {
    return new Response(JSON.stringify({ success: false, error: '缺少 ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }

  const service = new OssService(db, env.JWT_SECRET)

  try {
    if (request.method === 'GET') {
      const result = await service.getMaskedById(id, uid)
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    if (request.method === 'PUT') {
      const body = await request.json().catch(() => ({}))
      const result = await service.update(id, uid, body)
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    if (request.method === 'DELETE') {
      const result = await service.delete(id, uid)
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    return new Response(JSON.stringify({ success: false, error: '不支持的方法' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  } catch (e) {
    console.error('oss-configs/[id] API 错误:', e)
    return new Response(JSON.stringify({ success: false, error: e.message || '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
}