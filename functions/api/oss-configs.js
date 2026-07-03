// 阿里云 OSS 配置管理 API - 列表 / 创建
// GET  /api/oss-configs         获取当前用户所有配置（脱敏）
// POST /api/oss-configs         新增配置（需要登录，密钥加密存储）
import { AuthMiddleware } from '../middlewares/auth.js'
import { OssService } from '../services/ossService.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function onRequest(context) {
  const { request, env } = context

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
  const service = new OssService(db, env.JWT_SECRET)

  try {
    if (request.method === 'GET') {
      const result = await service.list(uid)
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const result = await service.create(uid, body)
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
    console.error('oss-configs API 错误:', e)
    return new Response(JSON.stringify({ success: false, error: e.message || '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
}