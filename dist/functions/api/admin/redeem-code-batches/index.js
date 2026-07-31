// Admin 兑换码批次列表 API
// 鉴权：functions/api/admin/_middleware.js
// GET /api/admin/redeem-code-batches?page=1&pageSize=20&keyword=xxx
//
// 返回分页的批次列表，每行聚合：total / used / note / credits / expires_at / created_at / created_by

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

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
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const offset = (page - 1) * pageSize

  try {
    // ---- 构造 WHERE ----
    // keyword 匹配：note 含关键词 / batch_id 前缀
    const where = []
    const args = []
    if (keyword) {
      where.push('(note LIKE ? OR batch_id LIKE ?)')
      args.push(`%${keyword}%`, `${keyword}%`)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    // ---- 数据查询 ----
    // 取同一批次下任意一行的 credits/expires_at/note/created_at/created_by，
    // 全部行的这些字段值相同（生成时一致写入；note 改动后会 UPDATE 整批行）。
    const listResult = await db
      .prepare(
        `SELECT batch_id,
                note,
                credits,
                expires_at,
                created_at,
                created_by,
                COUNT(*) AS total,
                SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) AS used
         FROM credit_redeem_codes
         ${whereSql}
         GROUP BY batch_id
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    // ---- 计数：满足条件的不同 batch_id 数量 ----
    const countResult = await db
      .prepare(
        `SELECT COUNT(DISTINCT batch_id) AS total
         FROM credit_redeem_codes
         ${whereSql}`,
      )
      .bind(...args)
      .first()
    const total = countResult?.total || 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return json({
      list: (listResult.results || []).map((r) => ({
        batch_id: r.batch_id,
        note: r.note,
        credits: r.credits,
        expires_at: r.expires_at,
        created_at: r.created_at,
        created_by: r.created_by,
        total: r.total,
        used: r.used || 0,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (err) {
    console.error('admin/redeem-code-batches list error:', err)
    return jsonError(err.message || '服务器错误', 500)
  }
}