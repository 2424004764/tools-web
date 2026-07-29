// Admin AI 媒体作品 API
// 鉴权：functions/api/admin/_middleware.js 已校验管理员身份
// 路由（本单文件）：
//   GET /api/admin/ai-media-works          列表（全部状态），支持分页/筛选

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_TYPES = new Set(['image', 'video'])
const VALID_AUDIT = new Set(['approved', 'pending', 'rejected'])

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const url = new URL(request.url)

  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const category = (url.searchParams.get('category') || '').trim()
  const type = (url.searchParams.get('type') || '').trim().toLowerCase()
  const audit = (url.searchParams.get('audit_status') || '').trim().toLowerCase()
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const offset = (page - 1) * pageSize

  const where = []
  const args = []
  if (category) {
    where.push('category = ?')
    args.push(category)
  }
  if (type && VALID_TYPES.has(type)) {
    where.push('media_type = ?')
    args.push(type)
  }
  if (audit && VALID_AUDIT.has(audit)) {
    where.push('audit_status = ?')
    args.push(audit)
  }
  if (keyword) {
    // 搜索 prompt / model_name / source_name / tags
    where.push(
      '(prompt LIKE ? OR model_name LIKE ? OR source_name LIKE ? OR tags LIKE ?)',
    )
    const like = `%${keyword}%`
    args.push(like, like, like, like)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM ai_media_works ${whereSql}`)
      .bind(...args)
      .first()
    const total = totalRow?.c || 0

    const list = await db
      .prepare(
        `SELECT id, media_type, media_url, thumbnail_url, prompt, category,
                model_name, source_name, source_url,
                width, height, duration, file_size, tags,
                audit_status, view_count, created_at, updated_at
         FROM ai_media_works
         ${whereSql}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const totalPages = Math.ceil(total / pageSize)
    return json({
      list: list.results || [],
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('admin ai-media-works list error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
