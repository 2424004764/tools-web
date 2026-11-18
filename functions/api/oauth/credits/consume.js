// 子站消费积分（一口价扣减）
// POST /api/oauth/credits/consume   Authorization: Bearer <access_token>（或 ?access_token=）
// body: { amount: number, reason: string, order_id?: string }
//
// scope: credits（授权页明示「代表你消费积分」）
//
// 设计要点（防漏扣 / 防双扣）：
//   1. 子站服务端「先扣后用」：本接口返回 200 才放行付费功能；余额不足/超时一律不放行
//   2. 原子扣减：条件 UPDATE ... WHERE balance - frozen >= amount（沿用 redeem.js 的套路，
//      D1 batch 对"UPDATE 命中 0 行"不报错，必须单独执行并检查 changes）
//   3. 幂等：order_id（子站业务单号）+ client_id 唯一索引。同单重试返回首次结果（deduplicated: true），
//      网络超时重试不会双扣
//   4. receipt：扣分成功签发 HMAC(client_secret) 签名的「已扣分发票」，子站付费功能入口验票，
//      防接口漏写扣费或前端绕过后端白嫖
//
// 错误码：401 invalid_token / 403 insufficient_scope / 400 invalid_request / 400 insufficient_credits / 500 server_error
import {
  oauthJson,
  oauthError,
  openCorsPreflight,
  lookupAccessToken,
  isTokenUsable,
  tokenHasScope,
  loadActiveClient,
  signReceipt,
  formatNow,
  RECEIPT_TTL_SECONDS,
} from '../_lib.js'
import { decryptSecret } from '../../../utils/crypto-secret.js'

const MAX_AMOUNT = 1_000_000 // 与后台手动调账同上限

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

    const client = await loadActiveClient(db, clientId)
    if (!client) return oauthError('invalid_token', '应用不存在或已停用', 401)
    // receipt 签名密钥 = 该应用 client_secret 明文（子站本地验票用同一个 secret）
    const clientSecretPlain = await decryptSecret(
      client.client_secret,
      env.ENCRYPTION_SECRET || env.JWT_SECRET,
    ).catch(() => null)
    if (!clientSecretPlain) return oauthError('server_error', '应用密钥读取失败', 500)

    // ============ 2. 参数校验 ============
    let body
    try {
      body = await request.json()
    } catch {
      return jsonError('invalid_request', '请求体必须是 JSON', 400)
    }
    const amount = Number(body?.amount)
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return jsonError('invalid_request', `amount 需为 1~${MAX_AMOUNT} 的整数（积分）`, 400)
    }
    const reason = String(body?.reason || '').trim().slice(0, 100)
    if (!reason) return jsonError('invalid_request', 'reason 必填（展示给用户的消费说明，≤100 字）', 400)
    // order_id 选填但强烈建议：子站业务单号，唯一索引保证同单重试不双扣
    const orderId = String(body?.order_id || '').trim()
    if (orderId && !/^[\w:-]{1,64}$/.test(orderId)) {
      return jsonError('invalid_request', 'order_id 需为 1~64 位字母/数字/下划线/连字符/冒号', 400)
    }

    const now = formatNow()
    // 用户流水带上应用名，用户在积分明细里能看懂是谁扣的
    const displayReason = `${client.name}消费：${reason}`

    // ============ 3. 幂等预检：同 client + order_id 已有消费流水 → 直接返回首次结果 ============
    if (orderId) {
      const existed = await db
        .prepare(
          `SELECT id, amount, balance_after, reason, created_at FROM credit_transactions
           WHERE client_id = ? AND order_id = ? AND type = 'deduct'`,
        )
        .bind(clientId, orderId)
        .first()
      if (existed) {
        return oauthJson({
          tx_id: existed.id,
          amount: existed.amount,
          balance_after: existed.balance_after,
          reason: existed.reason,
          receipt: await signReceipt(clientSecretPlain, {
            uid,
            client_id: clientId,
            tx_id: existed.id,
            amount: existed.amount,
            order_id: orderId,
          }),
          deduplicated: true,
        })
      }
    }

    // ============ 4. 原子扣减（单独执行条件 UPDATE，检查 changes）============
    const deduct = await db
      .prepare(
        `UPDATE user_credits
         SET balance = balance - ?, total_spent = total_spent + ?, updated_at = ?
         WHERE uid = ? AND balance - frozen >= ?`,
      )
      .bind(amount, amount, now, uid, amount)
      .run()

    if ((deduct?.meta?.changes ?? deduct?.changes ?? 0) === 0) {
      // 命中 0 行 = 余额不足（或用户无积分行），不透支
      return jsonError('insufficient_credits', '积分余额不足', 400)
    }

    // ============ 5. 写消费流水 ============
    const txId = crypto.randomUUID()
    try {
      await db
        .prepare(
          `INSERT INTO credit_transactions
             (id, uid, type, amount, balance_after, reason, operator_uid, source, client_id, order_id, created_at)
           VALUES (?, ?, 'deduct', ?, (SELECT balance FROM user_credits WHERE uid = ?), ?, 'SYSTEM', 'oauth', ?, ?, ?)`,
        )
        .bind(txId, uid, amount, uid, displayReason, clientId, orderId || null, now)
        .run()
    } catch (err) {
      // 唯一索引冲突 = 并发同单重试：另一请求已入账，补偿回滚本次扣减后返回首次结果
      if (orderId && String(err?.message || '').includes('UNIQUE')) {
        try {
          await db
            .prepare(`UPDATE user_credits SET balance = balance + ?, total_spent = total_spent - ?, updated_at = ? WHERE uid = ?`)
            .bind(amount, amount, now, uid)
            .run()
        } catch (e2) {
          console.error('[oauth/credits/consume] compensate error:', e2)
        }
        const existed = await db
          .prepare(
            `SELECT id, amount, balance_after, reason FROM credit_transactions
             WHERE client_id = ? AND order_id = ? AND type = 'deduct'`,
          )
          .bind(clientId, orderId)
          .first()
        if (existed) {
          return oauthJson({
            tx_id: existed.id,
            amount: existed.amount,
            balance_after: existed.balance_after,
            reason: existed.reason,
            receipt: await signReceipt(clientSecretPlain, {
              uid,
              client_id: clientId,
              tx_id: existed.id,
              amount: existed.amount,
              order_id: orderId,
            }),
            deduplicated: true,
          })
        }
      }
      // 其他错误：补偿回滚扣减，避免"扣了钱没有流水"
      try {
        await db
          .prepare(`UPDATE user_credits SET balance = balance + ?, total_spent = total_spent - ?, updated_at = ? WHERE uid = ?`)
          .bind(amount, amount, now, uid)
          .run()
      } catch (e2) {
        console.error('[oauth/credits/consume] compensate error:', e2)
      }
      console.error('[oauth/credits/consume] insert tx error:', err)
      return oauthError('server_error', '扣分失败，请重试（未扣分）', 500)
    }

    const balanceAfter = await db
      .prepare('SELECT balance FROM user_credits WHERE uid = ?')
      .bind(uid)
      .first()

    return oauthJson({
      tx_id: txId,
      amount,
      balance_after: Number(balanceAfter?.balance) || 0,
      reason: displayReason,
      // 「发票」：子站可用自己的 client_secret 本地验签（见 docs/oauth-provider.md）
      receipt: await signReceipt(clientSecretPlain, {
        uid,
        client_id: clientId,
        tx_id: txId,
        amount,
        order_id: orderId || null,
      }),
      receipt_ttl_seconds: RECEIPT_TTL_SECONDS,
    })
  } catch (error) {
    console.error('[oauth/credits/consume] error:', error)
    return oauthError('server_error', error.message || '服务器错误', 500)
  }
}
