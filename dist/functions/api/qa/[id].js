import { ApiResponse, initDatabase } from '../../utils/db.js'
import { QARouter } from '../../routes/qa.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  const id = pathParts[pathParts.length - 1]
  const origin = request.headers.get('Origin')

  // 添加调试日志
  console.log('QA [id] API Debug:', {
    method: request.method,
    pathname: url.pathname,
    pathParts,
    id,
    fullUrl: url.href
  })

  // 处理OPTIONS请求
  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  // 初始化数据库
  const dbInit = initDatabase(env)
  if (!dbInit.success) {
    return dbInit.response
  }

  try {
    // 创建路由实例并处理请求
    const router = new QARouter(dbInit.db)
    return await router.handle(request, id, env, origin)
  } catch (error) {
    console.error('QA API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}