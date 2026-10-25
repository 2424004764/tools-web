// 当前用户兑换积分码
// POST /api/me/redeem  body: { code: string }
//
// 鉴权：复用 extractUidFromRequest（model-resolver.js）
//
// 原子性（注意：D1 batch 只在语句 SQL 报错时回滚，"UPDATE 命中 0 行"不报错，
//         不能把条件 UPDATE 放进 batch 指望它失败时回滚）：
//   1) 单独执行 UPDATE credit_redeem_codes ... WHERE used_by IS NULL 抢占，检查 changes=0 则终止
//   2) 抢占成功后 batch 入账：user_credits 增量 UPSERT（禁止绝对值覆写）+ 流水
//      （balance_after 用子查询取同事务内入账后的真实余额）
//   3) 入账 batch 失败则补偿释放抢占，避免"码作废了钱没到账"
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

  // ============ 6. 查当前余额（响应里 balance_before 的参考值） ============
  const cur = await db
    .prepare('SELECT balance FROM user_credits WHERE uid = ?')
    .bind(uid)
    .first()
  const balanceBefore = Number(cur?.balance) || 0

  // ============ 7. 原子抢占兑换码（必须单独执行并检查 changes） ============
  let claim
  try {
    claim = await db
      .prepare(
        `UPDATE credit_redeem_codes
         SET used_by = ?, used_at = ?
         WHERE id = ? AND used_by IS NULL`,
      )
      .bind(uid, now, row.id)
      .run()
  } catch (err) {
    console.error('[me/redeem] claim error:', err)
    return jsonError('兑换失败，请稍后重试', 500)
  }
  if ((claim?.meta?.changes ?? claim?.changes ?? 0) === 0) {
    // 并发抢占失败：码刚被其他请求（或自己的双击）用掉
    return await failWrong('该兑换码已被使用', 400)
  }

  // ============ 8. 抢占成功：入账 + 流水 ============
  try {
    const results = await db.batch([
      // (a) 增量入账：新用户行初始余额 = credits；老用户行在现有余额上加增量。
      //     excluded.balance 不能直接覆盖（绝对值），并发下会丢更新。
      db
        .prepare(
          `INSERT INTO user_credits (uid, balance, total_earned, total_spent, frozen, created_at, updated_at)
           VALUES (?, ?, ?, 0, 0, ?, ?)
           ON CONFLICT(uid) DO UPDATE SET
             balance = balance + excluded.balance,
             total_earned = total_earned + excluded.total_earned,
             updated_at = excluded.updated_at`,
        )
        .bind(uid, credits, credits, now, now),
      // (b) 流水放在入账之后，balance_after 用子查询取同事务内的真实余额
      db
        .prepare(
          `INSERT INTO credit_transactions
           (id, uid, type, amount, balance_after, reason, operator_uid, source, created_at)
           VALUES (?, ?, 'grant', ?, (SELECT balance FROM user_credits WHERE uid = ?), ?, 'SYSTEM', 'recharge', ?)
           RETURNING balance_after`,
        )
        .bind(txId, uid, credits, uid, `兑换码 ${code}`, now),
    ])

    let balanceAfter = results?.[1]?.results?.[0]?.balance_after
    if (typeof balanceAfter !== 'number') {
      // RETURNING 未返回时兜底再读一次（仅影响响应展示，不影响流水记录）
      const r = await db
        .prepare('SELECT balance FROM user_credits WHERE uid = ?')
        .bind(uid)
        .first()
      balanceAfter = Number(r?.balance) || 0
    }

    return json({
      ok: true,
      data: {
        code,
        credits_granted: credits,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        tx_id: txId,
      },
    })
  } catch (err) {
    // ============ 9. 补偿：入账失败则释放抢占（只释放自己抢到的），用户可重试 ============
    console.error('[me/redeem] grant error:', err)
    try {
      await db
        .prepare(
          `UPDATE credit_redeem_codes
           SET used_by = NULL, used_at = NULL
           WHERE id = ? AND used_by = ?`,
        )
        .bind(row.id, uid)
        .run()
    } catch (e2) {
      console.error('[me/redeem] claim release error:', e2)
    }
    return jsonError('兑换失败，请稍后重试', 500)
  }
}
