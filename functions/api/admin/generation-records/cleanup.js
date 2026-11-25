// Admin 清理卡住的生成记录
// POST /api/admin/generation-records/cleanup
// Body: { olderThanMinutes?: number }  默认 15 分钟
//
// 把状态为 in_progress 且 created_at 早于阈值的记录批量标记为终态：
//   - 有扣费流水（uid + cost > 0 + tx_id）→ 先退还积分，标记 'reversed'
//   - 无扣费 → 标记 'failed'（含 cost > 0 但缺 tx_id 的异常行，留 error_message 提示人工核对）
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

// 与 credits.js:73 同风格的 UTC 'YYYY-MM-DD HH:mm:ss'
function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * 退还单条卡死记录的积分。
 * 先查是否已存在 reverse 流水 / 积分账户（防"reverse 成功但 finalize 被吞"的记录重复退款），
 * 再用 db.batch（D1 事务，任一失败整体回滚）原子执行：
 *   UPDATE 原子加回积分 → INSERT type='reverse' 流水（balance_after 用子查询取批内真实余额）。
 * UNIQUE(related_tx_id) 兜底防重入；3 次重试防 D1 瞬时故障（batch 原子性保证重试不会重复加钱）。
 * @returns {'ok' | 'already' | 'no_credits' | 'failed'}
 */
async function refundOne(env, uid, cost, relatedTxId, reason) {
  const db = env.DB
  const now = nowSql()
  const reverseTxId = crypto.randomUUID()

  try {
    // 已有 reverse 流水 → 积分已退过，无需再退（直接标 reversed）
    const existed = await db
      .prepare(
        `SELECT 1 FROM credit_transactions
         WHERE uid = ? AND related_tx_id = ? AND type = 'reverse' LIMIT 1`,
      )
      .bind(uid, relatedTxId)
      .first()
    if (existed) return 'already'

    // 积分账户不存在（如用户已被删除）→ 不能凭空造流水
    const creditsRow = await db
      .prepare(`SELECT 1 FROM user_credits WHERE uid = ? LIMIT 1`)
      .bind(uid)
      .first()
    if (!creditsRow) return 'no_credits'

    // batch = 隐式事务：任一语句失败整体回滚，重试不会重复加积分。
    // balance_after 用 INSERT ... SELECT 子查询取 batch 内 UPDATE 后的真实余额。
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await db.batch([
          db
            .prepare(
              `UPDATE user_credits
               SET balance = balance + ?,
                   total_spent = CASE WHEN total_spent >= ? THEN total_spent - ? ELSE 0 END,
                   updated_at = ?
               WHERE uid = ?`,
            )
            .bind(cost, cost, cost, now, uid),
          db
            .prepare(
              `INSERT INTO credit_transactions
               (id, uid, type, amount, balance_after, reason, operator_uid, source, related_tx_id, idempotency_key, created_at)
               SELECT ?, ?, ?, ?, (SELECT balance FROM user_credits WHERE uid = ?), ?, ?, ?, ?, ?, ?`,
            )
            .bind(
              reverseTxId, uid, 'reverse', cost, uid,
              reason, 'SYSTEM', 'tool', relatedTxId, null, now,
            ),
        ])
        return 'ok'
      } catch (err) {
        const msg = err?.message || ''
        // UNIQUE 冲突：同 related_tx_id 已有 reverse（并发防重入，整批已回滚）
        if (/UNIQUE.*related_tx_id/i.test(msg)) return 'already'
        console.error(`[admin/cleanup] refund attempt ${attempt} failed uid=${uid.slice(0, 8)} txId=${relatedTxId}`, msg)
        if (attempt >= 3) return 'failed'
        await new Promise((r) => setTimeout(r, 200 * 3 ** (attempt - 1)))
      }
    }
    return 'failed'
  } catch (err) {
    console.error(`[admin/cleanup] refund precheck failed uid=${uid.slice(0, 8)} txId=${relatedTxId}`, err?.message || err)
    return 'failed'
  }
}

/** 按状态批量更新终态（id 分块防 D1 bind 变量超限） */
async function finalizeRows(env, ids, status, errorMessage) {
  const db = env.DB
  const now = nowSql()
  const CHUNK = 50
  let changed = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const placeholders = chunk.map(() => '?').join(',')
    const result = await db
      .prepare(
        `UPDATE generation_records
         SET status = ?,
             error_message = ?,
             duration_ms = COALESCE(NULLIF(duration_ms, 0), CAST((julianday(?) - julianday(created_at)) * 86400000 AS INTEGER))
         WHERE status = 'in_progress' AND id IN (${placeholders})`,
      )
      .bind(status, errorMessage, now, ...chunk)
      .run()
    changed += result?.meta?.changes ?? result?.changes ?? 0
  }
  return changed
}

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

    // 先查卡死记录明细（方便前端展示"将清理 N 条" + 逐条退款）
    const { results: staleRows } = await db
      .prepare(
        `SELECT id, uid, cost, tx_id FROM generation_records
         WHERE status = 'in_progress'
           AND created_at < datetime('now', ?)
         ORDER BY created_at ASC`,
      )
      .bind(`-${minutes} minutes`)
      .all()
    const staleRowsList = staleRows || []

    if (staleRowsList.length === 0) {
      return json({ cleaned: 0, refunded: 0, markedFailed: 0, message: '没有卡住的记录' })
    }

    const now = nowSql()
    const refundedIds = []
    const failedIds = []
    let refundFailedCount = 0

    for (const row of staleRowsList) {
      const refundable = row.uid && row.cost > 0 && row.tx_id
      if (!refundable) {
        // cost > 0 但缺 tx_id：无法安全退款（没有防重锚点），留给人工核对
        failedIds.push(row.id)
        if (row.cost > 0) {
          refundFailedCount++
        }
        continue
      }
      const result = await refundOne(
        env, row.uid, row.cost, row.tx_id,
        `卡死记录清理自动退还（${minutes} 分钟阈值）`,
      )
      if (result === 'ok' || result === 'already') {
        refundedIds.push(row.id)
      } else {
        // no_credits / failed：退款没落库，标 failed 并提示人工核对
        failedIds.push(row.id)
        refundFailedCount++
        console.error('[admin/cleanup] REFUND FAILED — MANUAL INTERVENTION REQUIRED', {
          recordId: row.id, uid: row.uid, cost: row.cost, txId: row.tx_id, result,
        })
      }
    }

    let reversedCount = 0
    let failedCount = 0
    if (refundedIds.length > 0) {
      reversedCount = await finalizeRows(
        env, refundedIds, 'reversed',
        `历史卡死记录，已在 ${now} 清理并自动退还积分（阈值 ${minutes} 分钟）`,
      )
    }
    if (failedIds.length > 0) {
      failedCount = await finalizeRows(
        env, failedIds, 'failed',
        `历史卡死记录，已在 ${now} 手动清理（阈值 ${minutes} 分钟）${refundFailedCount > 0 ? '；部分记录未能自动退款，请人工核对积分' : ''}`,
      )
    }

    const cleaned = reversedCount + failedCount
    console.log(`[admin/cleanup] cleaned ${cleaned} stuck generation_records (reversed ${reversedCount} w/ refund, failed ${failedCount}, threshold ${minutes}min)`)
    return json({ cleaned, refunded: reversedCount, markedFailed: failedCount, thresholdMinutes: minutes })
  } catch (error) {
    console.error('admin generation-records/cleanup error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
