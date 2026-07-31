// Admin 兑换码批次单条 API
// 鉴权：functions/api/admin/_middleware.js
// 路由：
//   GET  /api/admin/redeem-code-batches/:batchId   批次详情（全部 codes + 统计）
//   PUT  /api/admin/redeem-code-batches/:batchId   body: { note }   更新该批次下所有码的备注

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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

  const db = env.DB
  const batchId = context.params?.batchId
  if (!batchId) return jsonError('缺少批次 id', 400)

  try {
    if (request.method === 'GET') {
      return await handleGet(db, batchId)
    }
    if (request.method === 'PUT') {
      return await handlePut(context, db, batchId)
    }
    return jsonError('不支持的请求方法', 405)
  } catch (err) {
    console.error('admin/redeem-code-batches [batchId] error:', err)
    return jsonError(err.message || '服务器错误', 500)
  }
}

// GET: 批次详情 + 全部 codes + total/used
async function handleGet(db, batchId) {
  // 批次元数据
  const meta = await db
    .prepare(
      `SELECT batch_id, note, credits, expires_at, created_at, created_by
       FROM credit_redeem_codes
       WHERE batch_id = ?
       LIMIT 1`,
    )
    .bind(batchId)
    .first()
  if (!meta) return jsonError('批次不存在', 404)

  // 全部 codes
  const codesResult = await db
    .prepare(
      `SELECT code FROM credit_redeem_codes
       WHERE batch_id = ?
       ORDER BY created_at`,
    )
    .bind(batchId)
    .all()
  const codes = (codesResult.results || []).map((r) => r.code)

  // 统计
  const stats = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) AS used
       FROM credit_redeem_codes
       WHERE batch_id = ?`,
    )
    .bind(batchId)
    .first()

  return json({
    batch_id: meta.batch_id,
    note: meta.note,
    credits: meta.credits,
    expires_at: meta.expires_at,
    created_at: meta.created_at,
    created_by: meta.created_by,
    total: stats?.total ?? codes.length,
    used: stats?.used ?? 0,
    codes,
  })
}

// PUT: 更新批次备注（同时作用于该 batch_id 下所有行）
async function handlePut(context, db, batchId) {
  const body = await context.request.json().catch(() => null)
  if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

  const sets = []
  const args = []

  if (body.note !== undefined) {
    if (body.note === null) {
      sets.push('note = ?')
      args.push(null)
    } else {
      if (typeof body.note !== 'string') {
        return jsonError('note 必须是字符串', 400)
      }
      const text = body.note.trim()
      if (text.length > 200) {
        return jsonError('note 不能超过 200 字符', 400)
      }
      sets.push('note = ?')
      args.push(text || null)
    }
  }

  if (sets.length === 0) return jsonError('没有要更新的字段', 400)

  args.push(batchId)
  const result = await db
    .prepare(`UPDATE credit_redeem_codes SET ${sets.join(', ')} WHERE batch_id = ?`)
    .bind(...args)
    .run()

  const changes = result.meta?.changes ?? result.changes ?? 0
  if (changes === 0) return jsonError('批次不存在', 404)

  console.log(`[admin/redeem-code-batches] batch=${batchId} updated note by adminUid=${context.data?.adminUid || '?'}`)
  return json({ updated: changes, batch_id: batchId })
}