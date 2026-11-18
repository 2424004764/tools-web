// 冒烟测试：site-config 充值配置（公开接口 + 后台白名单校验）
// 运行：node scripts/recharge-config.test.mjs
import assert from 'node:assert'

// ============ 极简 D1 mock（只实现本项目用到的 prepare().first()/.all()/.bind().run()）============
function makeDb(rows = {}) {
  const stmt = (sql) => {
    const db = mock
    const isUpsert = /INSERT INTO site_config/.test(sql)
    const isSelectAll = /SELECT key, value FROM site_config/.test(sql)
    const isSelectFirst = /WHERE key = '([^']+)'/.test(sql)
    const terminal = {
      async all() {
        assert.ok(isSelectAll, 'unexpected all() sql: ' + sql)
        return { results: [...db.store.entries()].map(([key, value]) => ({ key, value })) }
      },
      async first() {
        const m = sql.match(/WHERE key = '([^']+)'/)
        assert.ok(m, 'unexpected first() sql: ' + sql)
        const value = db.store.get(m[1])
        return value == null ? null : isSelectFirst ? { value } : null
      },
      async run() {
        assert.ok(isUpsert, 'unexpected run() sql: ' + sql)
        return { success: true }
      },
      async raw() {
        throw new Error('raw() not expected')
      },
    }
    return {
      ...terminal,
      // D1 bind：绑定参数后返回仍可执行任意终止方法的语句
      bind(...params) {
        if (isUpsert) {
          assert.equal(params.length, 3, 'upsert bind(key, value, remark)')
          const [key, value] = params
          return { ...terminal, async run() { db.store.set(key, value); return { success: true } } }
        }
        return terminal
      },
    }
  }
  const mock = {
    store: new Map(Object.entries(rows)),
    // 真实 D1 的 prepare 是同步的（utils/db.js 包装层不做 await）
    prepare(sql) {
      return stmt(sql)
    },
  }
  return mock
}

// 公开接口响应体为 { data: ... }（ApiResponse.success 的入参自带 data 包装）
const ok = (body) => ({ data: body })

// ============ 被测模块 ============
const pub = await import('../functions/api/site-config.js')
const admin = await import('../functions/api/admin/site-config.js')

const mkCtx = (db, { method = 'GET', url = 'https://x/api/site-config', body = null } = {}) => ({
  request: {
    method,
    url,
    headers: { get: () => null },
    json: async () => body,
  },
  env: { DB: db },
  waitUntil: () => {},
})

// ApiResponse 兼容：success(payload, origin) / error(msg, origin, status)
// （真实实现来自 functions/utils/db.js，这里直接用模块自带的 ApiResponse）
const resJson = async (r) => ({ status: r.status, body: await r.json() })

let db = makeDb()

// ---- 1. 未配置：默认 faka + 套餐 null（前台回退内置默认）----
let r = await resJson(await pub.onRequest(mkCtx(db, { url: 'https://x/api/site-config?config_key=recharge' })))
assert.equal(r.status, 200)
assert.deepEqual(r.body, ok({ mode: 'faka', qq: '', packages: null }))
console.log('1. 未配置默认 faka ✓')

// ---- 2. contact 模式：只返回 qq，packages 置 null（数据最小化）----
db = makeDb({ recharge_mode: 'contact', recharge_contact_qq: '123456789', recharge_packages: '[{"id":"pkg-1","name":"x","price":1,"credits":100,"url":"https://a/b"}]' })
r = await resJson(await pub.onRequest(mkCtx(db, { url: 'https://x/api/site-config?config_key=recharge' })))
assert.deepEqual(r.body, ok({ mode: 'contact', qq: '123456789', packages: null }))
console.log('2. contact 模式只返回 qq ✓')

// ---- 3. faka 模式：返回套餐，qq 置空；tag 空串被剔除 ----
db = makeDb({
  recharge_mode: 'faka',
  recharge_packages: JSON.stringify([
    { id: 'pkg-1yuan', name: '基础体验包', price: 1, credits: 100, url: 'https://9wa.br3.cn/vw', tag: '入门' },
    { id: 'pkg-10', name: '标准包', price: 10, credits: 1000, url: 'https://9wa.br3.cn/xx', tag: '' },
    { id: 'bad', name: '', url: 'not-url', price: -1, credits: 0 }, // 脏条目被丢弃
  ]),
})
r = await resJson(await pub.onRequest(mkCtx(db, { url: 'https://x/api/site-config?config_key=recharge' })))
assert.equal(r.body.data.mode, 'faka')
assert.equal(r.body.data.qq, '')
assert.equal(r.body.data.packages.length, 2)
assert.deepEqual(r.body.data.packages[0], { id: 'pkg-1yuan', name: '基础体验包', price: 1, credits: 100, url: 'https://9wa.br3.cn/vw', tag: '入门' })
assert.ok(!('tag' in r.body.data.packages[1]))
console.log('3. faka 模式套餐解析（含脏数据过滤）✓')

// ---- 4. 后台 PUT：合法套餐入库并归一化；非法值被拒 ----
db = makeDb()
let put = await resJson(await admin.onRequest(mkCtx(db, {
  method: 'PUT',
  url: 'https://x/api/admin/site-config',
  body: {
    recharge_mode: 'contact',
    recharge_contact_qq: '987654321',
    recharge_packages: JSON.stringify([{ id: 'PKG-1', name: '基础体验包', price: 1.5, credits: 150, url: 'https://9wa.br3.cn/vw', tag: '入门' }]),
  },
})))
assert.equal(put.status, 200)
assert.equal(put.body.data.values.recharge_mode, 'contact')
assert.equal(put.body.data.values.recharge_contact_qq, '987654321')
// id 归一小写、价格保留小数
assert.deepEqual(
  JSON.parse(put.body.data.values.recharge_packages),
  [{ id: 'pkg-1', name: '基础体验包', price: 1.5, credits: 150, url: 'https://9wa.br3.cn/vw', tag: '入门' }],
)
console.log('4. 后台 PUT 合法值入库 ✓')

// 非法 QQ → 400
put = await resJson(await admin.onRequest(mkCtx(db, {
  method: 'PUT', url: 'https://x/api/admin/site-config',
  body: { recharge_contact_qq: 'abc' },
})))
assert.equal(put.status, 400)
// 非法套餐（价格负数）→ 400
put = await resJson(await admin.onRequest(mkCtx(db, {
  method: 'PUT', url: 'https://x/api/admin/site-config',
  body: { recharge_packages: JSON.stringify([{ id: 'pkg-1', name: 'x', price: -1, credits: 100, url: 'https://a/b' }]) },
})))
assert.equal(put.status, 400)
// 非法 mode → 400
put = await resJson(await admin.onRequest(mkCtx(db, {
  method: 'PUT', url: 'https://x/api/admin/site-config',
  body: { recharge_mode: 'alipay' },
})))
assert.equal(put.status, 400)
console.log('5. 后台非法值拒绝（QQ/价格/mode）✓')

// ---- 6. 入库后公开接口读回 contact 模式 ----
r = await resJson(await pub.onRequest(mkCtx(db, { url: 'https://x/api/site-config?config_key=recharge' })))
assert.deepEqual(r.body.data, { mode: 'contact', qq: '987654321', packages: null })
console.log('6. 写入后公开接口读回 ✓')

// ---- 6.5. 只保存规格：不改动已存的充值方式/QQ（后台「保存规格」独立提交）----
put = await resJson(await admin.onRequest(mkCtx(db, {
  method: 'PUT', url: 'https://x/api/admin/site-config',
  body: { recharge_packages: JSON.stringify([{ id: 'pkg-5', name: '五元包', price: 5, credits: 500, url: 'https://9wa.br3.cn/5y' }]) },
})))
assert.equal(put.status, 200)
assert.equal(put.body.data.values.recharge_mode, 'contact')
assert.equal(put.body.data.values.recharge_contact_qq, '987654321')
// contact 模式下套餐虽已入库，公开接口仍只返回 qq（数据最小化）
r = await resJson(await pub.onRequest(mkCtx(db, { url: 'https://x/api/site-config?config_key=recharge' })))
assert.deepEqual(r.body.data, { mode: 'contact', qq: '987654321', packages: null })
console.log('6.5. 只保存规格不影响充值方式 ✓')

// ---- 7. 公开接口异常兜底（DB 抛错 → 默认 faka + null）----
const brokenDb = { prepare() { throw new Error('no table') } }
r = await resJson(await pub.onRequest(mkCtx(brokenDb, { url: 'https://x/api/site-config?config_key=recharge' })))
assert.equal(r.status, 200)
assert.deepEqual(r.body, ok({ mode: 'faka', qq: '', packages: null }))
console.log('7. 公开接口异常兜底 ✓')

// ---- 8. 其余 config_key 行为不受影响 ----
r = await resJson(await pub.onRequest(mkCtx(makeDb(), { url: 'https://x/api/site-config?config_key=not-allowed' })))
assert.equal(r.status, 400)
console.log('8. 非白名单 config_key 仍拒绝 ✓')

console.log('\n全部通过 ✅')
