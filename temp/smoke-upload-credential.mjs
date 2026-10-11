// storage-upload-credential 端点冒烟测试（离线，Node 直接跑）
// 覆盖：200 正常下发 / 401 无token / 401 token无效 / 403 无storage scope /
//       403 未登记桶 / 400 缺bytes / 402 额度不足 / 400 超单文件上限
// ESM 具名导入拼错会在 import 阶段报错；函数体局部变量笔误执行到即抛 ReferenceError。
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mod = await import(
  pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '../functions/api/oauth/storage-upload-credential.js')).href
)

const TOKEN_OK = { token_hash: 'h', client_id: 'tc_x', user_id: 'u1', scope: 'profile storage', expires_at: Math.floor(Date.now() / 1000) + 3600, revoked: 0, client_disabled: 0 }
const CLIENT_OK = { client_id: 'tc_x', client_secret: 'enc', name: 'n', description: '', logo_url: '', redirect_uris: 'https://x/cb', is_disabled: 0, r2_bucket: 'subsite-test' }

function makeDb(over = {}) {
  const state = {
    tokenRow: TOKEN_OK, clientRow: CLIENT_OK, userRow: { id: 'u1' },
    changes: 1, inserts: [], ...over,
  }
  const db = {
    prepare(sqlText) {
      const sql = String(sqlText)
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('oauth_access_tokens')) return state.tokenRow
              if (sql.includes('FROM oauth_clients')) return state.clientRow
              if (sql.includes('FROM user')) return state.userRow
              if (/storage_reservations[\s\S]*SUM/i.test(sql)) return { total: 0 }
              return null
            },
            async run() {
              if (/^\s*INSERT INTO subsite_uploads/i.test(sql)) state.inserts.push({ sql, args })
              return { meta: { changes: state.changes } }
            },
            async all() { return { results: [] } },
          }
        },
        async batch(stmts) { return stmts.map(() => ({ meta: { changes: 1 } })) },
      }
    },
  }
  return { db, state }
}

const ENV = { R2_ACCESS_KEY_ID: 'ak', R2_SECRET_ACCESS_KEY: 'sk', R2_ACCOUNT_ID: 'acc123' }

function makeRequest(body, token = 'tok') {
  return new Request('http://127.0.0.1/api/oauth/storage-upload-credential', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

let failed = 0
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  ${extra}`}`)
  if (!cond) failed++
}

// --- 200 正常下发 ---
{
  const { db, state } = makeDb()
  const res = await mod.onRequest({ request: makeRequest({ filename: '测试 文件.png', bytes: 12345, content_type: 'image/png' }), env: { DB: db, ...ENV } })
  const j = await res.json().catch(() => ({}))
  check('200 状态码', res.status === 200, `实际 ${res.status} ${JSON.stringify(j)}`)
  check('ok=true', j.ok === true)
  check('upload_id 为 UUID', /^[0-9a-f-]{36}$/i.test(j.upload_id || ''))
  check('upload_url 指向子站桶', (j.upload_url || '').includes('subsite-test.acc123.r2.cloudflarestorage.com'))
  check('签名锁了 content-length', (j.upload_url || '').includes('X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost'))
  check('object_key 前缀正确', (j.object_key || '').startsWith('subsite/u1/') && (j.object_key || '').endsWith('/测试 文件.png'))
  const ins = state.inserts[0]
  check('INSERT 列数=10 与 bind 数=9+pending', !!ins && ins.args.length === 9, ins && JSON.stringify(ins.args))
  check('INSERT 声明大小正确', !!ins && ins.args[5] === 12345)
}

// --- 异常分支 ---
{
  const { db } = makeDb()
  const res = await mod.onRequest({ request: makeRequest({ bytes: 1 }, ''), env: { DB: db, ...ENV } })
  check('无 token → 401', res.status === 401)
}
{
  const { db } = makeDb({ tokenRow: null })
  const res = await mod.onRequest({ request: makeRequest({ bytes: 1 }), env: { DB: db, ...ENV } })
  check('token 无效 → 401', res.status === 401)
}
{
  const { db } = makeDb({ tokenRow: { ...TOKEN_OK, scope: 'profile' } })
  const res = await mod.onRequest({ request: makeRequest({ bytes: 1 }), env: { DB: db, ...ENV } })
  check('无 storage scope → 403 insufficient_scope', res.status === 403 && (await res.json()).error === 'insufficient_scope')
}
{
  const { db } = makeDb({ clientRow: { ...CLIENT_OK, r2_bucket: '' } })
  const res = await mod.onRequest({ request: makeRequest({ bytes: 1 }), env: { DB: db, ...ENV } })
  const j = await res.json()
  check('未登记桶 → 403 upload_not_enabled', res.status === 403 && j.error === 'upload_not_enabled')
}
{
  const { db } = makeDb()
  const res = await mod.onRequest({ request: makeRequest({}), env: { DB: db, ...ENV } })
  check('缺 bytes → 400', res.status === 400)
}
{
  const { db } = makeDb({ changes: 0 }) // 条件 INSERT changes=0 → 预扣失败
  const res = await mod.onRequest({ request: makeRequest({ bytes: 1024 }), env: { DB: db, ...ENV } })
  const j = await res.json()
  check('额度不足 → 402 quota_exceeded', res.status === 402 && j.error === 'quota_exceeded')
}
{
  const { db } = makeDb()
  const res = await mod.onRequest({ request: makeRequest({ bytes: 501 * 1024 * 1024 }), env: { DB: db, ...ENV } })
  check('超单文件上限 → 400', res.status === 400)
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
