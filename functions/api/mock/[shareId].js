import { ApiResponse, initDatabase } from '../../utils/db.js'
import { generateMockData } from '../../utils/mockGenerator.js'

// 公开端点：GET /api/mock/:id
// 不需要鉴权；按 id 查 schema，每次请求重新生成 mock JSON 返回
export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  if (request.method !== 'GET') {
    return ApiResponse.error('Method not allowed', origin, 405)
  }

  if (!id || id.length < 4) {
    return ApiResponse.error('无效的 id', origin, 400)
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) return dbInit.response

  try {
    const row = await dbInit.db
      .prepare('SELECT schema, name, description FROM mock_schemas WHERE id = ?')
      .bind(id)
      .first()

    if (!row) {
      return ApiResponse.error('Mock 数据不存在', origin, 404)
    }

    let schema
    try {
      schema = JSON.parse(row.schema)
    } catch {
      return ApiResponse.error('Schema 解析失败', origin, 500)
    }

    const data = generateMockData(schema)
    return ApiResponse.success(data, origin)
  } catch (error) {
    console.error('生成 mock 数据失败:', error)
    return ApiResponse.error('生成 mock 数据失败', origin, 500)
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin')
  return ApiResponse.cors(origin)
}
