import { ApiResponse, initDatabase } from '../utils/db.js'
import { NotesRouter } from '../routes/notes.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/notes', '')

  // 处理OPTIONS请求
  if (request.method === 'OPTIONS') {
    return ApiResponse.cors()
  }

  // 初始化数据库
  const dbInit = initDatabase(env)
  if (!dbInit.success) {
    return dbInit.response
  }

  try {
    // 创建路由实例并处理请求（传入env用于JWT验证）
    const router = new NotesRouter(dbInit.db)
    return await router.handle(request, path, env)
  } catch (error) {
    console.error('Notes API error:', error)
    return ApiResponse.error('内部服务器错误', 500)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors()
}