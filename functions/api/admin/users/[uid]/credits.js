// Admin 赠送/扣减用户积分 API
// POST /api/admin/users/:uid/credits
// body: { type: 'grant'|'deduct', amount: number, reason?: string }
//
// type=grant:  余额 += amount, total_earned += amount
// type=deduct: 余额 -= amount, total_spent += amount，余额不足返回 400
//
// 鉴权已在 _middleware.js 完成。
//
// 关键：D1 不支持显式事务，用 db.batch() 顺序执行 UPSERT + INSERT，
// 若 deduct 的 UPDATE 影响行数=0（余额不足），立刻抛错让 batch 回滚。

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

export async function onRequest(context) {
  const { request, env, data } = context
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const uid = context.params?.uid
  if (!uid) return jsonError('缺少用户 id', 400)

  const body = await request.json().catch(() => ({}))
  const { type, amount, reason } = body

  // 参数校验
  if (type !== 'grant' && type !== 'deduct') {
    return jsonError('type 必须是 grant 或 deduct', 400)
  }
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
    return jsonError('amount 必须是 1~1000000 的正整数', 400)
  }

  try {
    // 用户存在性
    const user = await db.prepare('SELECT id FROM user WHERE id = ?').bind(uid).first()
    if (!user) return jsonError('用户不存在', 404)

    // 当前积分（不存在则视为 0）
    const cur = await db
      .prepare('SELECT balance FROM user_credits WHERE uid = ?')
      .bind(uid)
      .first()
    const currentBalance = cur?.balance || 0

    let newBalance
    if (type === 'grant') {
      newBalance = currentBalance + amount
    } else {
      if (currentBalance < amount) {
        return jsonError(`余额不足：当前 ${currentBalance}，需扣减 ${amount}`, 400)
      }
      newBalance = currentBalance - amount
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const txId = crypto.randomUUID()
    const operatorUid = data?.adminUid || 'SYSTEM'
    const signedAmount = type === 'grant' ? amount : -amount
    const reasonText = (reason || '').toString().slice(0, 200) || null

    // 准备 batch 语句
    let stmts
    if (type === 'grant') {
      stmts = [
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
          .bind(txId, uid, 'grant', signedAmount, newBalance, reasonText, operatorUid, 'admin', now),
      ]
    } else {
      // deduct: 用 UPDATE 带 WHERE balance >= amount 条件保证原子性
      stmts = [
        db
          .prepare(
            `UPDATE user_credits
             SET balance = balance - ?,
                 total_spent = total_spent + ?,
                 updated_at = ?
             WHERE uid = ? AND balance >= ?`,
          )
          .bind(amount, amount, now, uid, amount),
        db
          .prepare(
            `INSERT INTO credit_transactions
             (id, uid, type, amount, balance_after, reason, operator_uid, source, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(txId, uid, 'deduct', signedAmount, newBalance, reasonText, operatorUid, 'admin', now),
      ]
    }

    const results = await db.batch(stmts)

    // 校验 deduct 的 UPDATE 是否实际改了行
    if (type === 'deduct') {
      const deductResult = results[0]
      const changes = deductResult?.meta?.changes ?? deductResult?.changes ?? 0
      if (changes === 0) {
        return jsonError('扣减失败：余额不足或积分记录不存在', 400)
      }
    }

    return json({
      txId,
      uid,
      type,
      amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      created_at: now,
    })
  } catch (error) {
    console.error('admin/credits error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}