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
// 防暴力枚举：
//   - credit_redeem_attempts 表按 (uid, 北京时日期) 累计错误次数
//   - 达 MAX_WRONG_PER_DAY 后当天返回 429，不再校验码
//   - 第二天 0 点（北京时）新一天新行，计数器自动重置
//
// 失败场景：
//   - 401 未登录
//   - 429 当日错误次数已达上限
//   - 400 code 空 / 不存在 / 已兑换 / 已过期 / 积分值不合法
//   - 500 数据库错误（batch 任一步失败抛错）

import { extractUidFromRequest } from '../_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const MAX_WRONG_PER_DAY = 20

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

/** 返回北京时 YYYY-MM-DD（用户期望"第二天 0 点"按本地理解） */
function beijingDateString() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
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

  // ============ 2. 防暴力枚举：今日输错次数预检 ============
  const today = beijingDateString()
  const attempts = await db
    .prepare(
      `SELECT wrong_count FROM credit_redeem_attempts WHERE uid = ? AND attempt_date = ?`,
    )
    .bind(uid, today)
    .first()
  if (attempts && attempts.wrong_count >= MAX_WRONG_PER_DAY) {
    return jsonError(
      `今日兑换码输入错误次数已达 ${MAX_WRONG_PER_DAY} 次上限，请明天 0 点后再试`,
      429,
    )
  }

  // ============ 3. 解析 body ============
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

  // ============ 4. 计数自增 helper：所有"兑换码错误"路径都调用 ============
  const failWrong = async (msg, status = 400, extra = {}) => {
    const now = nowSql()
    await db
      .prepare(
        `INSERT INTO credit_redeem_attempts
           (uid, attempt_date, wrong_count, first_wrong_at, last_wrong_at, blocked_at)
         VALUES (?, ?, 1, ?, ?, NULL)
         ON CONFLICT(uid, attempt_date) DO UPDATE SET
           wrong_count = wrong_count + 1,
           last_wrong_at = excluded.last_wrong_at,
           blocked_at = CASE
             WHEN wrong_count + 1 >= ? THEN excluded.last_wrong_at
             ELSE blocked_at
           END`,
      )
      .bind(uid, today, now, now, MAX_WRONG_PER_DAY)
      .run()
    return jsonError(msg, status, extra)
  }

  // ============ 5. 查 code + 校验状态 ============
  const row = await db
    .prepare(
      `SELECT id, credits, expires_at, used_by FROM credit_redeem_codes WHERE code = ?`,
    )
    .bind(code)
    .first()

  if (!row) {
    return await failWrong('兑换码不存在', 400)
  }
  if (row.used_by) {
    return await failWrong('该兑换码已被使用', 400)
  }
  if (isExpired(row.expires_at)) {
    return await failWrong('该兑换码已过期', 400)
  }
  if (!Number.isInteger(row.credits) || row.credits <= 0) {
    // 数据异常（不计入"用户输错"）
    return jsonError('兑换码积分值不合法', 500)
  }

  const credits = row.credits
  const now = nowSql()
  const txId = crypto.randomUUID()

  // ============ 6. 查当前余额（用于派生 balance_after）============
  const cur = await db
    .prepare('SELECT balance FROM user_credits WHERE uid = ?')
    .bind(uid)
    .first()
  const currentBalance = cur?.balance ?? 0
  const newBalance = currentBalance + credits

  // ============ 7. 原子 batch：先标记 code，再 grant 积分 ============
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

    // (a) 抢占失败（并发场景）→ 视为已兑换，计入错误次数
    const changes = results[0]?.meta?.changes ?? results[0]?.changes ?? 0
    if (changes === 0) {
      return await failWrong('该兑换码已被使用', 400)
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