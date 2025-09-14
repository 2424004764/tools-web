import { ApiResponse, initDatabase } from '../../utils/db.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()
  const origin = request.headers.get('Origin')

  // 处理OPTIONS请求
  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  // 只允许GET请求
  if (request.method !== 'GET') {
    return ApiResponse.error('Method not allowed', origin, 405)
  }

  // 初始化数据库
  const dbInit = initDatabase(env)
  if (!dbInit.success) {
    return dbInit.response
  }

  try {
    // 查询QA页面
    const qa = await dbInit.db.prepare(`
      SELECT id, title, qa_items, header_content, footer_content, is_public, create_time, update_time
      FROM qa_pages 
      WHERE id = ? AND is_public = 1
    `).bind(id).first()

    if (!qa) {
      return ApiResponse.error('QA页面不存在或未公开', origin, 404)
    }

    // 格式化返回数据
    const qaData = {
      id: qa.id,
      title: qa.title,
      qaItems: qa.qa_items ? JSON.parse(qa.qa_items) : [],
      headerContent: qa.header_content || '',
      footerContent: qa.footer_content || '',
      isPublic: Boolean(qa.is_public),
      createTime: qa.create_time,
      updateTime: qa.update_time
    }

    return ApiResponse.success(qaData, origin)
  } catch (error) {
    console.error('获取QA页面失败:', error)
    return ApiResponse.error('获取QA页面失败', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
