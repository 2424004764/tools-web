// Admin 批量调整积分 API
// POST /api/admin/users/credits/batch
// body: { type: 'grant'|'deduct', amount: number, reason?: string, uids?: string[] }
//
// 范围策略：
//   - uids 缺省 / 空数组 → 作用于所有非管理员用户（自动排除 is_admin=1），LIMIT 1000 防止误伤
//   - uids 非空 → 仅作用于列表中的 uid，自动过滤管理员 uid（不计为失败，仅跳过）
//
// 单 uid 规则（与 functions/api/admin/users/[uid]/credits.js 完全一致）：
//   - grant: UPSERT user_credits + INSERT credit_transactions
//   - deduct: SELECT 当前余额，actual = min(amount, balance)；
//     若余额为 0 → 跳过；若 deduct 后余额=0 → 正常写流水（amount 记实际值的相反数）
//   - UPDATE ... WHERE balance >= actual 保证原子性（防透支）
//   - 每 uid 的两条语句包在一个 db.batch() 里，D1 不支持跨 uid 事务，但单 uid 内原子
//   - 流水 reason 自动追加「（申请 N，实际 M）」便于审计 deduct 的部分成功
//
// 单 uid 失败不影响其他 uid，最终返回 succeeded / skipped / failed 明细。
//
// 鉴权已在 _middleware.js 完成（context.data.adminUid 已注入）。

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

// 全部用户模式上限，防止单次请求过载
const ALL_USERS_LIMIT = 1000
// 单次显式指定 uids 的上限（与 tools/batch-toggle.js 保持一致）
const EXPLICIT_UIDS_LIMIT = 200

export async function onRequest(context) {
  const { request, env, data } = context
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  const db = env.DB

  const body = await request.json().catch(() => ({}))
  const { type, amount, reason, uids } = body

  // ========== 参数校验 ==========
  if (type !== 'grant' && type !== 'deduct') {
    return jsonError('type 必须是 grant 或 deduct', 400)
  }
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
    return jsonError('amount 必须是 1~1000000 的正整数', 400)
  }
  const reasonText = (reason || '').toString().slice(0, 200) || null

  let targetUids = []
  let adminUid = null // 用于过滤掉发起人本身（防止误把自己扣光）
  if (typeof data === 'object' && data !== null && data.adminUid) {
    adminUid = data.adminUid
  }

  try {
    if (Array.isArray(uids) && uids.length > 0) {
      // 显式 uids 模式
      if (uids.length > EXPLICIT_UIDS_LIMIT) {
        return jsonError(
          `单次最多指定 ${EXPLICIT_UIDS_LIMIT} 个 uid，当前 ${uids.length}`,
          400,
        )
      }
      // 去重 + 校验类型
      const seen = new Set()
      for (const u of uids) {
        if (typeof u !== 'string' || !u) continue
        seen.add(u)
      }
      const candidates = Array.from(seen)

      // 过滤掉管理员和发起人
      if (candidates.length === 0) {
        return json({ total: 0, succeeded: 0, skipped: 0, failed: [], total_delta: 0, balance_change_total: 0 })
      }

      const placeholders = candidates.map(() => '?').join(',')
      const filters = []
      const filterParams = []
      if (adminUid) {
        filters.push('id != ?')
        filterParams.push(adminUid)
      }
      filters.push('is_admin = 0')
      const whereSql = `WHERE id IN (${placeholders})${filters.length ? ' AND ' + filters.join(' AND ') : ''}`

      const rows = await db
        .prepare(`SELECT id FROM user ${whereSql}`)
        .bind(...candidates, ...filterParams)
        .all()
      targetUids = (rows.results || []).map((r) => r.id)
    } else {
      // 全部非管理员用户模式
      const filters = ['is_admin = 0']
      const filterParams = []
      if (adminUid) {
        filters.push('id != ?')
        filterParams.push(adminUid)
      }
      const rows = await db
        .prepare(
          `SELECT id FROM user WHERE ${filters.join(' AND ')} LIMIT ?`,
        )
        .bind(...filterParams, ALL_USERS_LIMIT)
        .all()
      targetUids = (rows.results || []).map((r) => r.id)
    }

    if (targetUids.length === 0) {
      return json({
        total: 0,
        succeeded: 0,
        skipped: 0,
        failed: [],
        total_delta: 0,
        balance_change_total: 0,
      })
    }

    // ========== 逐 uid 处理 ==========
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const operatorUid = data?.adminUid || 'SYSTEM'
    const failed = []
    let succeeded = 0
    let skipped = 0
    let totalDelta = 0 // 有符号：grant +amount, deduct -actual
    let balanceChangeTotal = 0 // |变动| 绝对值之和（审计用）

    for (const uid of targetUids) {
      try {
        if (type === 'grant') {
          // grant: 简化逻辑，直接 UPSERT，流水 amount = +amount
          // 先尝试读取当前余额，便于流水 balance_after
          const cur = await db
            .prepare('SELECT balance FROM user_credits WHERE uid = ?')
            .bind(uid)
            .first()
          const currentBalance = cur?.balance || 0
          const newBalance = currentBalance + amount
          const txId = crypto.randomUUID()

          const stmts = [
            db
              .prepare(
                `INSERT INTO user_credits (uid, balance, total_earned, total_spent, frozen, created_at, updated_at)
                 VALUES (?, ?, ?, 0, 0, ?, ?)
                 ON CONFLICT(uid) DO UPDATE SET
                   balance = excluded.balance,
                   total_earned = total_earned + excluded.total_earned,
                   updated_at = excluded.updated_at`,
              )
              .bind(uid, newBalance, amount, now, now),
            db
              .prepare(
                `INSERT INTO credit_transactions
                 (id, uid, type, amount, balance_after, reason, operator_uid, source, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(txId, uid, 'grant', amount, newBalance, reasonText, operatorUid, 'admin', now),
          ]
          await db.batch(stmts)
          succeeded++
          totalDelta += amount
          balanceChangeTotal += amount
        } else {
          // deduct: 取当前余额，actual = min(amount, balance)
          const cur = await db
            .prepare('SELECT balance FROM user_credits WHERE uid = ?')
            .bind(uid)
            .first()
          const currentBalance = cur?.balance || 0

          if (currentBalance <= 0) {
            skipped++
            continue
          }

          const actual = Math.min(amount, currentBalance)
          const newBalance = currentBalance - actual
          const txId = crypto.randomUUID()
          // 审计：若实际扣减 < 申请，在 reason 末尾追加备注
          const finalReason =
            actual < amount
              ? (reasonText ? `${reasonText}（申请 ${amount}，实际 ${actual}）` : `批量扣减（申请 ${amount}，实际 ${actual}）`)
              : reasonText

          const stmts = [
            db
              .prepare(
                `UPDATE user_credits
                 SET balance = balance - ?,
                     total_spent = total_spent + ?,
                     updated_at = ?
                 WHERE uid = ? AND balance >= ?`,
              )
              .bind(actual, actual, now, uid, actual),
            db
              .prepare(
                `INSERT INTO credit_transactions
                 (id, uid, type, amount, balance_after, reason, operator_uid, source, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(txId, uid, 'deduct', -actual, newBalance, finalReason, operatorUid, 'admin', now),
          ]
          const results = await db.batch(stmts)

          // 校验 deduct 的 UPDATE 是否实际改了行（防并发场景）
          const deductResult = results[0]
          const changes = deductResult?.meta?.changes ?? deductResult?.changes ?? 0
          if (changes === 0) {
            failed.push({ uid, error: '余额不足或积分记录不存在（并发更新）' })
            continue
          }

          succeeded++
          totalDelta -= actual
          balanceChangeTotal += actual
        }
      } catch (err) {
        failed.push({ uid, error: err?.message || '未知错误' })
      }
    }

    return json({
      total: targetUids.length,
      succeeded,
      skipped,
      failed,
      total_delta: totalDelta,
      balance_change_total: balanceChangeTotal,
    })
  } catch (error) {
    console.error('admin/users/credits/batch error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}