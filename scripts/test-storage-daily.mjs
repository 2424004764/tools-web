// 本地验证 /api/admin/storage/daily 的 SQL 与响应结构（node:sqlite 模拟 D1）
// 用法：node scripts/test-storage-daily.mjs
import { DatabaseSync } from 'node:sqlite'
import { onRequest } from '../functions/api/admin/storage/daily.js'

// ---- 建最小 schema（只建 daily.js 涉及的表与列）----
const db = new DatabaseSync(':memory:')
db.exec(`
  CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT, username TEXT, avatar TEXT, is_admin INTEGER DEFAULT 0);
  CREATE TABLE music_songs (id TEXT PRIMARY KEY, uid TEXT, title TEXT, file_size INTEGER, created_at TEXT);
  CREATE TABLE ai_creation_images (id TEXT PRIMARY KEY, uid TEXT, filename TEXT, prompt TEXT, file_size INTEGER, created_at TEXT);
  CREATE TABLE subsite_uploads (id TEXT PRIMARY KEY, uid TEXT, client_id TEXT, object_key TEXT, content_type TEXT,
    declared_bytes INTEGER, actual_bytes INTEGER, status TEXT, created_at TEXT, settled_at TEXT);
  CREATE TABLE oauth_clients (client_id TEXT PRIMARY KEY, name TEXT);
  CREATE TABLE shopping_list_image_uploads (r2_key TEXT PRIMARY KEY, uid TEXT, reservation_id TEXT,
    declared_bytes INTEGER, actual_bytes INTEGER, status TEXT, lock_token TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE storage_reservations (id TEXT PRIMARY KEY, uid TEXT, bytes INTEGER, created_at TEXT);
  CREATE TABLE user_storage_quota (uid TEXT PRIMARY KEY, quota_bytes INTEGER, used_bytes INTEGER, updated_at TEXT);
`)

// ---- 造数：UTC+8 的 2026-11-08 = UTC 2026-11-07 16:00 ~ 2026-11-08 15:59 ----
const DAY = '2026-11-08'
db.prepare(`INSERT INTO user VALUES ('u1','a@x.com','甲',NULL,1),('u2','b@x.com','乙',NULL,0),('u3','c@x.com','丙',NULL,0)`).run()
// u1：当天音乐 2MB + AI 图 3MB；前一天音乐 5MB
db.prepare(`INSERT INTO music_songs VALUES ('m1','u1','歌1',2097152,'2026-11-08 01:00:00'),('m2','u1','歌0',5242880,'2026-11-07 01:00:00')`).run()
db.prepare(`INSERT INTO ai_creation_images VALUES ('i1','u1','f.png','prompt...',3145728,'2026-11-08 10:30:00')`).run()
// u2：当天子站 settled 1MB(实际) + pending 9MB(不计) + 前一天 settled 2MB
db.prepare(`INSERT INTO oauth_clients VALUES ('cli1','子站A')`).run()
db.prepare(`INSERT INTO subsite_uploads VALUES
  ('s1','u2','cli1','sub/u2/a.bin','application/octet-stream',900000,1048576,'settled','2026-11-08 03:00:00','2026-11-08 03:05:00'),
  ('s2','u2','cli1','sub/u2/b.bin','application/octet-stream',9437184,NULL,'pending','2026-11-08 04:00:00',NULL),
  ('s3','u2','cli1','sub/u2/c.bin','application/octet-stream',2097152,2097152,'settled','2026-11-07 05:00:00','2026-11-07 05:10:00')`).run()
// u3：当天购物清单 confirmed 0.5MB + confirming 7MB(不计)
db.prepare(`INSERT INTO shopping_list_image_uploads VALUES
  ('k1','u3','r1',524288,524288,'confirmed',NULL,'2026-11-08 06:00:00','2026-11-08 06:01:00'),
  ('k2','u3','r2',7340032,NULL,'confirming',NULL,'2026-11-08 06:30:00','2026-11-08 06:31:00')`).run()

// D1 风格的 mock：prepare().bind().all()/first()，以及 batch
const wrap = (stmt) => ({
  bind: (...args) => {
    const s = stmt
    return {
      all: () => s.all(...args),
      first: () => s.get(...args),
      run: () => s.run(...args),
    }
  },
})
const mockDB = {
  prepare: (sql) => wrap(db.prepare(sql)),
  batch: async (stmts) => {
    const out = []
    for (const st of stmts) out.push({ results: await st.all().all ? st.all().all : st.all() })
    return out
  },
}

// batch 里的语句先 prepare 再 bind：mock 一下与 D1 相同的链式行为
const makeRequest = (query) =>
  onRequest({
    request: new Request(`https://x/api/admin/storage/daily${query}`),
    env: { DB: mockDB },
  })

let failed = 0
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`)
  if (!cond) failed++
}
const MB = 1048576

// ---- 用例 1：当日汇总 + 用户列表（无 uid）----
const mk = (sql) => {
  const stmt = db.prepare(sql)
  const bound = { params: [], stmt }
  const api = {
    bind: (...args) => { bound.params = args; return api },
    all: () => { const r = stmt.all(...bound.params); return { results: r } },
    first: () => { const r = stmt.get(...bound.params); return { results: [r] } },
    run: () => stmt.run(...bound.params),
  }
  return api
}
mockDB.prepare = mk
mockDB.batch = async (stmts) => Promise.all(stmts.map((s) => s.all()))

let res = await makeRequest(`?date=${DAY}&pageSize=10&trendDays=7`)
let data = JSON.parse(await res.text()).data
check('HTTP 200 & success', res.status === 200)
check('当日总量 = 2+3+1+0.5 MB', data.summary.totalBytes === 6.5 * MB, JSON.stringify(data.summary))
check('当日文件数 = 4', data.summary.totalFiles === 4)
check('涉及用户 = 3', data.summary.users === 3)
check('来源拆解 music 2MB/1个', data.summary.sources.music.bytes === 2 * MB && data.summary.sources.music.count === 1)
check('来源拆解 subsite 仅 settled 1MB/1个', data.summary.sources.subsite.bytes === 1 * MB && data.summary.sources.subsite.count === 1)
check('来源拆解 shoppingList 仅 confirmed 0.5MB', data.summary.sources.shoppingList.bytes === 0.5 * MB)
check('列表按当日用量降序', data.list.map((r) => r.uid).join(',') === 'u1,u2,u3', JSON.stringify(data.list.map((r) => [r.uid, r.totalBytes])))
check('列表含用户信息', data.list[0].email === 'a@x.com' && data.list[0].isAdmin === true)
check('趋势零填充 7 天', data.trend.length === 7 && data.trend.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date)))
const tDay = data.trend.find((p) => p.date === DAY)
const tPrev = data.trend.find((p) => p.date === '2026-11-07')
check('趋势当日 6.5MB/4文件/3人', tDay.bytes === 6.5 * MB && tDay.files === 4 && tDay.users === 3)
check('趋势前一日 7MB(5+2)/2文件/2人', tPrev.bytes === 7 * MB && tPrev.files === 2 && tPrev.users === 2, JSON.stringify(tPrev))

// ---- 用例 2：keyword 过滤 ----
res = await makeRequest(`?date=${DAY}&keyword=a@x.com`)
data = JSON.parse(await res.text()).data
check('keyword 过滤只剩 u1', data.list.length === 1 && data.list[0].uid === 'u1' && data.pagination.total === 1)

// ---- 用例 3：uid 模式（u2 当天子站记录）----
res = await makeRequest(`?date=${DAY}&uid=u2`)
data = JSON.parse(await res.text()).data
check('uid 模式用户信息', data.user.email === 'b@x.com')
check('uid 模式汇总仅计 settled 1MB/1文件', data.summary.totalBytes === 1 * MB && data.summary.totalFiles === 1, JSON.stringify(data.summary))
check('uploads 含 pending 记录(观察队列)', data.uploads.length === 2 && data.uploads.some((u) => u.status === 'pending'))
check('uploads 带子站应用名', data.uploads[0].clientName === '子站A')
check('files 为空(当天无落库文件)', data.files.length === 0)

// ---- 用例 4：uid 模式（u1 当天音乐+AI图）----
res = await makeRequest(`?date=${DAY}&uid=u1`)
data = JSON.parse(await res.text()).data
check('u1 files 合并 2 条并按时间倒序', data.files.length === 2 && data.files[0].type === 'ai_creation' && data.files[1].type === 'music')

// ---- 用例 5：非法参数 ----
res = await makeRequest(`?date=not-a-date`)
check('非法 date 返回 400', res.status === 400)

// ---- 用例 6：缺表降级（模拟线上 D1 未跑迁移 105：没有 shopping_list_image_uploads）----
db.exec('DROP TABLE shopping_list_image_uploads')
res = await makeRequest(`?date=${DAY}&pageSize=10&trendDays=7`)
data = JSON.parse(await res.text()).data
check('缺表时不报错（HTTP 200）', res.status === 200)
check('缺表名放进 missingTables', JSON.stringify(data.missingTables) === JSON.stringify(['shopping_list_image_uploads']), JSON.stringify(data.missingTables))
check('缺表来源计 0', data.summary.sources.shoppingList.bytes === 0 && data.summary.sources.shoppingList.count === 0)
check('总量剔除缺表来源 = 6MB / 3 文件 / 2 人', data.summary.totalBytes === 6 * MB && data.summary.totalFiles === 3 && data.summary.users === 2, JSON.stringify(data.summary))
check('u3（仅购物清单）从列表消失', data.list.every((r) => r.uid !== 'u3'))
check('u1/u2 数据不变', data.list.map((r) => r.uid).join(',') === 'u1,u2')

// uid 模式在缺表下也不报错
res = await makeRequest(`?date=${DAY}&uid=u3`)
data = JSON.parse(await res.text()).data
check('缺表下 uid 模式不报错且 files 为空', res.status === 200 && data.files.length === 0)

console.log(failed === 0 ? '\n全部通过 ✔' : `\n${failed} 个用例失败 ✘`)
process.exit(failed === 0 ? 0 : 1)
