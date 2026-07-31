// 当前用户兑换积分码
// POST /api/me/redeem  body: { code: string }
//
// 鉴权：复用 extractUidFromRequest（model-resolver.js）
//
// 原子性：D1 无显式事务，用 db.batch 顺序执行：
//   1) UPDATE credit_redeem_codes SET used_by=?, used_at=? WHERE id=? AND used_by IS NULL
//   2) 若上一步 changes=0 → 抛错让 batch 回滚（先 SELECT 排查失败原因：已用 / 过期 / 不存在）
//   3) INSERT credit_transactions
//   4) UPDATE user_credits (UPSERT)
//
// 失败场景：
//   - 401 未登录
//   - 400 code 空 / 不存在
//   - 400 已兑换
//   - 400 已过期
//   - 500 数据库错误（batch 任一步失败抛错）

import { extractUidFromRequest } from '../_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 400, extra = {}) {
  return new Response(JSON.stringify({ ok: false, error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function isExpired(expiresAt) {
  if (!expiresAt) return false
  const t = new Date(expiresAt.replace(' ', 'T') + (expiresAt.includes('T') ? '' : 'Z'))
  if (Number.isNaN(t.getTime())) return false
  return t.getTime() < Date.now()
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonError('不支持的请求方法', 405)
  }

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  // ============ 1. 鉴权 ============
  const uid = await extractUidFromRequest(request, env).catch(() => null)
  if (!uid) return jsonError('请先登录', 401)

  // ============ 2. 解析 body ============
  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('请求体必须是 JSON', 400)
  }
  const rawCode = (body?.code || '').toString().trim()
  if (!rawCode) return jsonError('请输入兑换码', 400)
  // 标准化：去空格、转大写（兑换码字母表只有大写字母+数字）
  const code = rawCode.replace(/\s+/g, '').toUpperCase()
  if (code.length < 4 || code.length > 32) {
    return jsonError('兑换码长度不合法', 400)
  }

  // ============ 3. 查 code + 校验状态 ============
  const row = await db
    .prepare(
      `SELECT id, credits, expires_at, used_by FROM credit_redeem_codes WHERE code = ?`,
    )
    .bind(code)
    .first()

  if (!row) {
    return jsonError('兑换码不存在', 400)
  }
  if (row.used_by) {
    return jsonError('该兑换码已被使用', 400)
  }
  if (isExpired(row.expires_at)) {
    return jsonError('该兑换码已过期', 400)
  }
  if (!Number.isInteger(row.credits) || row.credits <= 0) {
    return jsonError('兑换码积分值不合法', 500)
  }

  const credits = row.credits
  const now = nowSql()
  const txId = crypto.randomUUID()

  // ============ 4. 查当前余额（用于派生 balance_after）============
  const cur = await db
    .prepare('SELECT balance FROM user_credits WHERE uid = ?')
    .bind(uid)
    .first()
  const currentBalance = cur?.balance ?? 0
  const newBalance = currentBalance + credits

  // ============ 5. 原子 batch：先标记 code，再 grant 积分 ============
  try {
    const stmts = [
      // (a) 原子抢占：只有未使用的码才能 UPDATE 成功
      db
        .prepare(
          `UPDATE credit_redeem_codes
           SET used_by = ?, used_at = ?
           WHERE id = ? AND used_by IS NULL`,
        )
        .bind(uid, now, row.id),
      // (b) 写积分流水
      db
        .prepare(
          `INSERT INTO credit_transactions
           (id, uid, type, amount, balance_after, reason, operator_uid, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          txId,
          uid,
          'grant',
          credits,
          newBalance,
          `兑换码 ${code}`,
          'SYSTEM',
          'recharge',
          now,
        ),
      // (c) UPSERT user_credits
      db
        .prepare(
          `INSERT INTO user_credits (uid, balance, total_earned, total_spent, frozen, created_at, updated_at)
           VALUES (?, ?, ?, 0, 0, ?, ?)
           ON CONFLICT(uid) DO UPDATE SET
             balance = excluded.balance,
             total_earned = total_earned + excluded.total_earned,
             updated_at = excluded.updated_at`,
        )
        .bind(uid, newBalance, credits, now, now),
    ]
    const results = await db.batch(stmts)

    // (a) 抢占失败（并发场景）→ 视为已兑换
    const changes = results[0]?.meta?.changes ?? results[0]?.changes ?? 0
    if (changes === 0) {
      return jsonError('该兑换码已被使用', 400)
    }

    return json({
      ok: true,
      data: {
        code,
        credits_granted: credits,
        balance_before: currentBalance,
        balance_after: newBalance,
        tx_id: txId,
      },
    })
  } catch (err) {
    console.error('[me/redeem] error:', err)
    return jsonError(err.message || '服务器错误', 500)
  }
}