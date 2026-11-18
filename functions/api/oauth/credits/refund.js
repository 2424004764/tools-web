// 子站退款（按消费流水原额退还）
// POST /api/oauth/credits/refund   Authorization: Bearer <access_token>（或 ?access_token=）
// body: { tx_id: string, reason?: string }
//
// scope: credits
//
// 规则：
//   - 只能退本应用（client_id 匹配）、本用户（uid 匹配）的 oauth 消费流水
//   - 一笔消费只能退一次：退款流水 related_tx_id 指向原流水，重复退款返回首次结果（deduplicated: true）
//   - 只退全额（简单版；按量差额结算后续如需再扩展）
//   - 退款只回加余额，不回滚 total_spent（统计口径：消费过又退还）
//
// 使用场景：子站扣分成功后功能执行失败（上游报错/生成失败），调用本接口把积分退还给用户。
import {
  oauthJson,
  oauthError,
  openCorsPreflight,
  lookupAccessToken,
  isTokenUsable,
  tokenHasScope,
  formatNow,
} from '../_lib.js'

function jsonError(error, description, status) {
  return oauthJson({ error, error_description: description }, status)
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return openCorsPreflight()
  if (request.method !== 'POST') return oauthError('invalid_request', '仅支持 POST', 405)

  const db = env.DB
  if (!db) return oauthError('server_error', '数据库未配置', 500)

  try {
    // ============ 1. 鉴权 + scope ============
    const authHeader = request.headers.get('Authorization') || ''
    const url = new URL(request.url)
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (url.searchParams.get('access_token') || '').trim()
    if (!token) return oauthError('invalid_token', '缺少 access_token', 401)

    const tokenRow = await lookupAccessToken(db, token)
    if (!tokenRow || !isTokenUsable(tokenRow)) {
      return oauthError('invalid_token', 'access_token 无效或已过期', 401)
    }
    if (!tokenHasScope(tokenRow, 'credits')) {
      return oauthError('insufficient_scope', '该 access_token 未被授予 credits scope，请引导用户重新授权', 403)
    }
    const uid = tokenRow.user_id
    const clientId = tokenRow.client_id

    // ============ 2. 参数校验 ============
    let body
    try {
      body = await request.json()
    } catch {
      return jsonError('invalid_request', '请求体必须是 JSON', 400)
    }
    const txId = String(body?.tx_id || '').trim()
    if (!txId) return jsonError('invalid_request', 'tx_id 必填（consume 返回的消费流水 id）', 400)
    const reasonNote = String(body?.reason || '').trim().slice(0, 100)

    // ============ 3. 查原消费流水（只能退自己应用的、本用户的 oauth 消费）============
    const origin = await db
      .prepare(
        `SELECT id, uid, type, amount, source, client_id, reason FROM credit_transactions WHERE id = ?`,
      )
      .bind(txId)
      .first()
    if (!origin || origin.type !== 'deduct' || origin.source !== 'oauth' || origin.client_id !== clientId || origin.uid !== uid) {
      return jsonError('invalid_request', 'tx_id 不是本应用对该用户的消费流水', 400)
    }

    // ============ 4. 幂等预检：已退过 → 返回首次结果 ============
    const refunded = await db
      .prepare(
        `SELECT id, amount, balance_after FROM credit_transactions
         WHERE related_tx_id = ? AND type = 'refund'`,
      )
      .bind(txId)
      .first()
    if (refunded) {
      return oauthJson({
        refund_tx_id: refunded.id,
        tx_id: txId,
        amount: refunded.amount,
        balance_after: refunded.balance_after,
        deduplicated: true,
      })
    }

    // ============ 5. 原子退款：batch 事务（余额回加 + 写退款流水）============
    // uq_credit_tx_oauth_refund 唯一索引保证并发双退时第二条 INSERT 报错，
    // batch 整体回滚（余额不会回加两次）；余额回加用增量 UPDATE，禁止绝对值覆写。
    const amount = origin.amount
    const now = formatNow()
    const refundTxId = crypto.randomUUID()
    const refundReason = `退款：${origin.reason}${reasonNote ? `（${reasonNote}）` : ''}`

    try {
      const results = await db.batch([
        db
          .prepare(`UPDATE user_credits SET balance = balance + ?, updated_at = ? WHERE uid = ?`)
          .bind(amount, now, uid),
        db
          .prepare(
            `INSERT INTO credit_transactions
               (id, uid, type, amount, balance_after, reason, operator_uid, source, client_id, related_tx_id, created_at)
             VALUES (?, ?, 'refund', ?, (SELECT balance FROM user_credits WHERE uid = ?), ?, 'SYSTEM', 'oauth', ?, ?, ?)
             RETURNING balance_after`,
          )
          .bind(refundTxId, uid, amount, uid, refundReason, clientId, txId, now),
      ])

      let balanceAfter = results?.[1]?.results?.[0]?.balance_after
      if (typeof balanceAfter !== 'number') {
        const r = await db
          .prepare('SELECT balance FROM user_credits WHERE uid = ?')
          .bind(uid)
          .first()
        balanceAfter = Number(r?.balance) || 0
      }

      return oauthJson({
        refund_tx_id: refundTxId,
        tx_id: txId,
        amount,
        balance_after: balanceAfter,
      })
    } catch (err) {
      // 并发双退：另一请求已退款，本事务整体回滚，返回首次结果
      if (String(err?.message || '').includes('UNIQUE')) {
        const existed = await db
          .prepare(
            `SELECT id, amount, balance_after FROM credit_transactions
             WHERE related_tx_id = ? AND type = 'refund'`,
          )
          .bind(txId)
          .first()
        if (existed) {
          return oauthJson({
            refund_tx_id: existed.id,
            tx_id: txId,
            amount: existed.amount,
            balance_after: existed.balance_after,
            deduplicated: true,
          })
        }
      }
      console.error('[oauth/credits/refund] error:', err)
      return oauthError('server_error', '退款失败，请重试（未退款）', 500)
    }
  } catch (error) {
    console.error('[oauth/credits/refund] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}
