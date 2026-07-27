// Admin 清理卡住的生成记录
// POST /api/admin/generation-records/cleanup
// Body: { olderThanMinutes?: number }  默认 15 分钟
//
// 把状态为 in_progress 且 created_at 早于阈值的记录批量标记为 'failed'。
// 设计意图：清理历史卡死记录（旧 bug、worker 被 CF 平台 kill 等）。
//
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

const DEFAULT_THRESHOLD_MINUTES = 15
const MIN_THRESHOLD_MINUTES = 1 // 防止误操作清理正在跑的请求

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const minutes = Math.max(
    MIN_THRESHOLD_MINUTES,
    parseInt(body?.olderThanMinutes) || DEFAULT_THRESHOLD_MINUTES,
  )

  try {
    const db = env.DB

    // 先查条数（方便前端展示"将清理 N 条"）
    const countRow = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM generation_records
         WHERE status = 'in_progress'
           AND created_at < datetime('now', ?)`,
      )
      .bind(`-${minutes} minutes`)
      .first()
    const staleCount = countRow?.c || 0

    if (staleCount === 0) {
      return json({ cleaned: 0, message: '没有卡住的记录' })
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const result = await db
      .prepare(
        `UPDATE generation_records
         SET status = 'failed',
             error_message = ?,
             duration_ms = COALESCE(NULLIF(duration_ms, 0), CAST((julianday(?) - julianday(created_at)) * 86400000 AS INTEGER))
         WHERE status = 'in_progress'
           AND created_at < datetime('now', ?)`,
      )
      .bind(
        `历史卡死记录，已在 ${now} 手动清理（阈值 ${minutes} 分钟）`,
        now,
        `-${minutes} minutes`,
      )
      .run()

    const cleaned = result?.meta?.changes ?? result?.changes ?? 0
    console.log(`[admin/cleanup] cleaned ${cleaned} stuck generation_records (threshold ${minutes}min)`)
    return json({ cleaned, thresholdMinutes: minutes })
  } catch (error) {
    console.error('admin generation-records/cleanup error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}