// 冒烟测试：子站积分消费（oauth/credits consume + refund + receipt 签验签）
// 运行：node scripts/oauth-credits.test.mjs
// 纯 mock：db.prepare 按 SQL 特征分派到内存表；encryptSecret 生成与线上一致的 v2 密文。
import assert from 'node:assert'
import crypto from 'node:crypto'
import { encryptSecret } from '../functions/utils/crypto-secret.js'

const { onRequest: consume } = await import('../functions/api/oauth/credits/consume.js')
const { onRequest: refund } = await import('../functions/api/oauth/credits/refund.js')
const { signReceipt, verifyReceipt } = await import('../functions/api/oauth/_lib.js')

// ============ 环境 ============
const ENC_SECRET = 'test-enc-secret'
const CLIENT_ID = 'tc_test01'
const CLIENT_SECRET = 'tcs_plain_secret_01'
const CLIENT_NAME = '题迹'
const UID = 'user-1'
const TOKEN = 'oat_tok1'
const TOKEN_HASH = crypto.createHash('sha256').update(TOKEN).digest('hex')

const resJson = async (r) => ({ status: r.status, body: await r.json() })
const mkCtx = (db, { body = {}, token = TOKEN } = {}) => ({
  request: {
    method: 'POST',
    url: 'https://x/api/oauth/credits/consume',
    headers: { get: (h) => (h === 'Authorization' ? `Bearer ${token}` : null) },
    json: async () => body,
  },
  env: { DB: db, ENCRYPTION_SECRET: ENC_SECRET },
  waitUntil: () => {},
})

// ============ keyed D1 stub：按 SQL 特征分派（consume/refund 用到的语句是有限集合）============
async function makeDb({ credits = { balance: 100, frozen: 0 }, scope = 'profile credits' } = {}) {
  const encSecretValue = await encryptSecret(CLIENT_SECRET, ENC_SECRET)
  const state = {
    user_credits: { uid: UID, balance: credits.balance, total_earned: credits.balance, total_spent: 0, frozen: credits.frozen },
    transactions: new Map(), // id → row
    token: {
      token_hash: TOKEN_HASH, client_id: CLIENT_ID, user_id: UID, scope,
      expires_at: Math.floor(Date.now() / 1000) + 3600, revoked: 0,
      client_disabled: 0, user_exists: 1, user_disabled: 0,
    },
    client: {
      client_id: CLIENT_ID, client_secret: encSecretValue, name: CLIENT_NAME,
      description: '', logo_url: '', redirect_uris: '', is_disabled: 0, r2_bucket: null,
    },
  }
  const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

  const executors = [
    // lookupAccessToken
    {
      match: (sql) => sql.includes('FROM oauth_access_tokens'),
      run: async () => ({ ...state.token }),
    },
    // loadActiveClient
    {
      match: (sql) => sql.includes('FROM oauth_clients'),
      run: async () => ({ ...state.client }),
    },
    // 幂等预检 / 并发冲突重查：SELECT ... WHERE client_id = ? AND order_id = ? AND type = 'deduct'
    {
      match: (sql) => sql.includes('WHERE client_id = ? AND order_id = ?'),
      run: async (p) => {
        for (const row of state.transactions.values()) {
          if (row.client_id === p[0] && row.order_id === p[1] && row.type === 'deduct') return { ...row }
        }
        return null
      },
    },
    // 退款预检：WHERE related_tx_id = ? AND type = 'refund'
    {
      match: (sql) => sql.includes('WHERE related_tx_id = ?'),
      run: async (p) => {
        for (const row of state.transactions.values()) {
          if (row.related_tx_id === p[0] && row.type === 'refund') return { ...row }
        }
        return null
      },
    },
    // 原消费流水：WHERE id = ?
    {
      match: (sql) => sql.includes('FROM credit_transactions WHERE id = ?'),
      run: async (p) => {
        const row = state.transactions.get(p[0])
        return row ? { ...row } : null
      },
    },
    // 条件扣减：UPDATE ... WHERE uid = ? AND balance - frozen >= ?
    {
      match: (sql) => sql.includes('UPDATE user_credits') && sql.includes('balance - frozen >= ?'),
      run: async (p) => {
        const [amount, , , uid, required] = p
        const u = state.user_credits
        if (!u || u.uid !== uid || u.balance - u.frozen < required) return { meta: { changes: 0 } }
        u.balance -= amount
        u.total_spent += amount
        return { meta: { changes: 1 } }
      },
    },
    // 补偿回滚（consume）：balance = balance + ? 且 total_spent = total_spent - ?
    {
      match: (sql) => sql.includes('UPDATE user_credits') && sql.includes('total_spent = total_spent - ?'),
      run: async (p) => {
        const [amount] = p
        state.user_credits.balance += amount
        state.user_credits.total_spent -= amount
        return { meta: { changes: 1 } }
      },
    },
    // 退款回加（refund batch 第一条）：balance = balance + ? 且无 total_spent
    {
      match: (sql) => sql.includes('UPDATE user_credits') && sql.includes('balance = balance + ?'),
      run: async (p) => {
        state.user_credits.balance += p[0]
        return { meta: { changes: 1 } }
      },
    },
    // 消费流水 INSERT（deduct）
    {
      match: (sql) => sql.includes('INSERT INTO credit_transactions') && sql.includes("'deduct'"),
      run: async (p) => {
        // (id, uid, amount, uid子查询占位, reason, client_id, order_id, created_at) → 按 bind 顺序
        // 实际 bind: [txId, uid, amount, uid, displayReason, clientId, orderId|NULL, now]
        const [id, uid, amount, , reason, client_id, order_id] = p
        const row = {
          id, uid, type: 'deduct', amount,
          balance_after: state.user_credits.balance,
          reason, operator_uid: 'SYSTEM', source: 'oauth',
          client_id, order_id: order_id ?? null, related_tx_id: null, created_at: nowSql(),
        }
        state.transactions.set(id, row)
        return { meta: { changes: 1 }, results: [{ balance_after: row.balance_after }] }
      },
    },
    // 退款流水 INSERT（refund，含 RETURNING）
    {
      match: (sql) => sql.includes('INSERT INTO credit_transactions') && sql.includes("'refund'"),
      run: async (p) => {
        // bind: [refundTxId, uid, amount, uid, reason, clientId, txId, now]
        const [id, uid, amount, , reason, client_id, related_tx_id] = p
        const row = {
          id, uid, type: 'refund', amount,
          balance_after: state.user_credits.balance,
          reason, operator_uid: 'SYSTEM', source: 'oauth',
          client_id, order_id: null, related_tx_id, created_at: nowSql(),
        }
        state.transactions.set(id, row)
        return { meta: { changes: 1 }, results: [{ balance_after: row.balance_after }] }
      },
    },
    // 余额查询
    {
      match: (sql) => sql.includes('SELECT balance FROM user_credits'),
      run: async () => ({ balance: state.user_credits.balance }),
    },
  ]

  const stmtFor = (sql, params) => ({
    bind(...p) { return stmtFor(sql, p) },
    async first() {
      for (const e of executors) if (e.match(sql)) return e.run(params)
      throw new Error('test stub: unhandled SELECT ' + sql)
    },
    async run() {
      for (const e of executors) if (e.match(sql)) return e.run(params)
      throw new Error('test stub: unhandled RUN ' + sql)
    },
  })

  return {
    state,
    prepare(sql) { return stmtFor(sql, []) },
    async batch(statements) {
      // D1 batch 事务：任一语句报错整体回滚（这里语句都不会报错；UNIQUE 语义由预检覆盖）
      const out = []
      for (const s of statements) out.push(await s.__run?.() ?? await s.run())
      return out
    },
  }
}

// ============ [1] receipt 签验签（_lib 纯函数） ============
console.log('[1] receipt 签验签')
{
  const payload = { uid: UID, client_id: CLIENT_ID, tx_id: 'tx-1', amount: 10, order_id: 'o-1' }
  const receipt = await signReceipt(CLIENT_SECRET, payload)
  const verified = await verifyReceipt(CLIENT_SECRET, receipt, CLIENT_ID)
  assert.ok(verified, '验签通过')
  assert.equal(verified.uid, UID)
  assert.equal(verified.amount, 10)
  assert.ok(verified.exp > Math.floor(Date.now() / 1000), 'exp 自动填充')

  // 篡改签名 → 拒绝
  const [p, s] = receipt.split('.')
  assert.equal(await verifyReceipt(CLIENT_SECRET, `${p}.${'0'.repeat(s.length)}`, CLIENT_ID), null, '篡改签名拒绝')
  // 错误密钥 → 拒绝
  assert.equal(await verifyReceipt('wrong-secret', receipt, CLIENT_ID), null, '错误密钥拒绝')
  // client_id 不匹配 → 拒绝
  assert.equal(await verifyReceipt(CLIENT_SECRET, receipt, 'tc_other'), null, 'client_id 不匹配拒绝')
  // 过期 → 拒绝
  const expired = await signReceipt(CLIENT_SECRET, { ...payload, exp: Math.floor(Date.now() / 1000) - 1 })
  assert.equal(await verifyReceipt(CLIENT_SECRET, expired, CLIENT_ID), null, '过期拒绝')
  // 格式坏 → 拒绝
  assert.equal(await verifyReceipt(CLIENT_SECRET, 'garbage', CLIENT_ID), null, '坏格式拒绝')
  console.log('  ✓ 签验签 / 篡改 / 错密钥 / 错归属 / 过期 / 坏格式')

  // 文档示例算法（node:crypto）与主站一致
  const expect = crypto.createHmac('sha256', CLIENT_SECRET).update(p).digest('hex')
  assert.equal(expect, s, 'node crypto 与主站 HMAC 一致（文档验签示例可用）')
  console.log('  ✓ 文档 Node 验签示例与主站算法一致')
}

// ============ [2] consume 正常扣分 ============
console.log('[2] consume 正常扣分')
{
  const db = await makeDb({ credits: { balance: 100, frozen: 0 } })
  const r = await resJson(await consume(mkCtx(db, { body: { amount: 10, reason: 'AI 讲解一道题', order_id: 'tiji-1' } })))
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.equal(r.body.amount, 10)
  assert.equal(r.body.balance_after, 90)
  assert.match(r.body.reason, new RegExp(CLIENT_NAME), '流水带应用名前缀')
  assert.ok(r.body.tx_id && r.body.receipt)

  const v = await verifyReceipt(CLIENT_SECRET, r.body.receipt, CLIENT_ID)
  assert.ok(v && v.tx_id === r.body.tx_id && v.amount === 10, 'receipt 可验且内容正确')

  assert.equal(db.state.user_credits.balance, 90, '余额 90')
  assert.equal(db.state.user_credits.total_spent, 10, '累计消费 10')
  const tx = db.state.transactions.get(r.body.tx_id)
  assert.equal(tx.source, 'oauth')
  assert.equal(tx.client_id, CLIENT_ID)
  assert.equal(tx.order_id, 'tiji-1')
  console.log('  ✓ 扣 10 分 / 余额与流水正确 / receipt 可验')
}

// ============ [3] 余额不足拒绝且不动账 ============
console.log('[3] 余额不足')
{
  const db = await makeDb({ credits: { balance: 5, frozen: 0 } })
  const r = await resJson(await consume(mkCtx(db, { body: { amount: 10, reason: 'x' } })))
  assert.equal(r.status, 400)
  assert.equal(r.body.error, 'insufficient_credits')
  assert.equal(db.state.user_credits.balance, 5, '余额不变')
  assert.equal(db.state.transactions.size, 0, '无流水')
  console.log('  ✓ 余额不足 400 / 不透支 / 无流水')
}

// ============ [4] frozen 占用时可用余额不足 → 拒绝 ============
console.log('[4] frozen 冻结')
{
  const db = await makeDb({ credits: { balance: 100, frozen: 95 } })
  const r = await resJson(await consume(mkCtx(db, { body: { amount: 10, reason: 'x' } })))
  assert.equal(r.status, 400)
  assert.equal(r.body.error, 'insufficient_credits')
  console.log('  ✓ 可用余额（balance-frozen）不足时拒绝')
}

// ============ [5] 幂等：同 order_id 重试只扣一次 ============
console.log('[5] 幂等重试')
{
  const db = await makeDb({ credits: { balance: 100, frozen: 0 } })
  const body = { amount: 10, reason: 'AI 讲解', order_id: 'same-order' }
  const r1 = await resJson(await consume(mkCtx(db, { body })))
  const r2 = await resJson(await consume(mkCtx(db, { body })))
  assert.equal(r1.status, 200)
  assert.equal(r2.status, 200)
  assert.equal(r2.body.deduplicated, true, '重试返回 deduplicated')
  assert.equal(r2.body.tx_id, r1.body.tx_id, '同一笔流水')
  assert.equal(db.state.user_credits.balance, 90, '只扣一次')
  console.log('  ✓ 同 order_id 重试 deduplicated / 只扣一次')
}

// ============ [6] 参数校验 ============
console.log('[6] 参数校验')
{
  const db = await makeDb()
  assert.equal((await resJson(await consume(mkCtx(db, { body: { amount: 0, reason: 'x' } })))).status, 400, 'amount=0 拒绝')
  assert.equal((await resJson(await consume(mkCtx(db, { body: { amount: 10 } })))).status, 400, '缺 reason 拒绝')
  assert.equal((await resJson(await consume(mkCtx(db, { body: { amount: 10, reason: 'x', order_id: '非法 key!' } })))).status, 400, '非法 order_id 拒绝')
  assert.equal((await resJson(await consume(mkCtx(db, { token: '' })))).status, 401, '无 token 401')
  console.log('  ✓ amount/reason/order_id/token 校验')
}

// ============ [7] scope 校验 ============
console.log('[7] scope 校验')
{
  const db = await makeDb({ scope: 'profile storage' })
  const r = await resJson(await consume(mkCtx(db, { body: { amount: 10, reason: 'x' } })))
  assert.equal(r.status, 403)
  assert.equal(r.body.error, 'insufficient_scope')
  console.log('  ✓ 无 credits scope → 403 insufficient_scope')
}

// ============ [8] refund 正常退款 ============
console.log('[8] refund 退款')
{
  const db = await makeDb({ credits: { balance: 100, frozen: 0 } })
  const c = await resJson(await consume(mkCtx(db, { body: { amount: 10, reason: 'AI 讲解', order_id: 'o-1' } })))
  const r = await resJson(await refund(mkCtx(db, { body: { tx_id: c.body.tx_id, reason: '生成失败' } })))
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.equal(r.body.amount, 10)
  assert.equal(r.body.balance_after, 100, '退回后余额 100')
  assert.equal(db.state.user_credits.balance, 100, '余额回加')

  const refundRow = db.state.transactions.get(r.body.refund_tx_id)
  assert.equal(refundRow.type, 'refund')
  assert.equal(refundRow.related_tx_id, c.body.tx_id, '退款流水指向原消费')
  assert.equal(refundRow.source, 'oauth')
  console.log('  ✓ 全额退款 / 余额回加 / 流水可溯源')
}

// ============ [9] refund 幂等：重复退只退一次 ============
console.log('[9] refund 幂等')
{
  const db = await makeDb({ credits: { balance: 100, frozen: 0 } })
  const c = await resJson(await consume(mkCtx(db, { body: { amount: 10, reason: 'x', order_id: 'o-2' } })))
  const r1 = await resJson(await refund(mkCtx(db, { body: { tx_id: c.body.tx_id } })))
  const r2 = await resJson(await refund(mkCtx(db, { body: { tx_id: c.body.tx_id } })))
  assert.equal(r1.status, 200)
  assert.equal(r2.status, 200)
  assert.equal(r2.body.deduplicated, true, '第二次 deduplicated')
  assert.equal(r2.body.refund_tx_id, r1.body.refund_tx_id)
  assert.equal(db.state.user_credits.balance, 100, '只退一次')
  console.log('  ✓ 重复退款 deduplicated / 只退一次')
}

// ============ [10] refund 越权：非本应用流水 / 非本用户流水 ============
console.log('[10] refund 越权')
{
  const db = await makeDb()
  // 伪造一条别家应用的消费流水
  db.state.transactions.set('tx-other', {
    id: 'tx-other', uid: UID, type: 'deduct', amount: 10, balance_after: 90,
    reason: '别家消费', operator_uid: 'SYSTEM', source: 'oauth',
    client_id: 'tc_other', order_id: null, related_tx_id: null, created_at: '2026-01-01 00:00:00',
  })
  const r = await resJson(await refund(mkCtx(db, { body: { tx_id: 'tx-other' } })))
  assert.equal(r.status, 400, '退别家应用流水被拒')
  assert.equal(db.state.user_credits.balance, 100, '余额不动')
  console.log('  ✓ 退别家应用流水 → 400 / 不动账')
}

console.log('\n全部通过 ✅')
