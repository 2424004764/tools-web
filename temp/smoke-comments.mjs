// 临时冒烟测试：带管理员 JWT 走完评论审核全流程（node temp/smoke-comments.mjs）
import crypto from 'node:crypto'
import fs from 'node:fs'

const env = fs.readFileSync('.dev.vars', 'utf8')
const secret = env.match(/JWT_SECRET\s*=\s*(.+)/)[1].trim()
const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const h = b64u({ alg: 'HS256', typ: 'JWT' })
const p = b64u({
  uid: '67f81709-f26d-4316-ad2b-d0e43ed64d21',
  email: '2424004764@qq.com',
  username: 'admin',
  avatar: '',
  is_admin: 1,
  iat: now,
  exp: now + 86400,
})
const sig = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64url')
const token = h + '.' + p + '.' + sig

const base = 'http://127.0.0.1:8788'
const auth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }

const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const get = (url) => fetch(base + url)
const adminGet = (url) => fetch(base + url, { headers: auth })
const adminPut = (url, body) => fetch(base + url, { method: 'PUT', headers: auth, body: JSON.stringify(body) })
const adminDelete = (url) => fetch(base + url, { method: 'DELETE', headers: auth })

let failed = 0
const check = (name, cond, detail) => {
  if (cond) console.log('PASS', name, detail ?? '')
  else { failed++; console.log('FAIL', name, detail ?? '') }
}

// 1. 游客提交评论 → pending，前台不可见
let r = await post('/api/comments', { path: '/md5', content: '后台审核流程测试', nickname: '游客甲', email: 'guest@test.com' })
let j = await r.json()
check('1 游客提交', r.status === 201 && j.data.status === 'pending', r.status)
const id = j.data.id

// 2. 后台待审列表能看到
r = await adminGet('/api/admin/comments?status=pending')
j = await r.json()
check('2 后台待审列表', r.status === 200 && j.data.list.some((c) => c.id === id), `count=${j.data.list.length} counts=${JSON.stringify(j.data.counts)}`)

// 3. 审核通过 → 前台可见
r = await adminPut('/api/admin/comments/' + id, { status: 'approved' })
j = await r.json()
check('3 审核通过', r.status === 200 && j.data.status === 'approved' && !!j.data.reviewed_by)
r = await get('/api/comments?path=/md5')
j = await r.json()
if (!j.data) console.log('DEBUG 3b status=', r.status, 'body=', JSON.stringify(j).slice(0, 300))
check('3b 前台可见', !!j.data && j.data.list.some((c) => c.id === id), `total=${j.data?.pagination?.total}`)

// 4. 切换评论系统为 custom
r = await adminPut('/api/admin/site-config', { comment_system: 'custom' })
j = await r.json()
check('4 切换 custom', r.status === 200 && j.data.comment_system === 'custom')
r = await get('/api/site-config')
check('4b 公开配置生效', (await r.json()).data.comment_system === 'custom')

// 5. 配置校验：非法 repo_id
r = await adminPut('/api/admin/site-config', { giscus_repo_id: 'BAD_ID!!' })
j = await r.json()
check('5 非法repo_id拦截', r.status === 400 && !!j.error, j.error)

// 6. repo 归一化
r = await adminPut('/api/admin/site-config', { giscus_repo: 'https://github.com/foo/bar.git' })
j = await r.json()
check('6 repo归一化', j.data.giscus_repo === 'foo/bar', j.data.giscus_repo)

// 7. 拒绝后前台不可见；删除成功
r = await post('/api/comments', { path: '/md5', content: '待删评论', nickname: '游客乙', email: 'g2@test.com' })
const id2 = (await r.json()).data.id
r = await adminPut('/api/admin/comments/' + id2, { status: 'rejected' })
check('7 拒绝', r.status === 200 && (await r.json()).data.status === 'rejected')
r = await adminDelete('/api/admin/comments/' + id2)
check('7b 删除', r.status === 200)

// 8. 已登录用户提交（带 token）：昵称取自账号，游客字段忽略
r = await post('/api/comments', { path: '/md5', content: '登录用户测试', nickname: 'hack', email: 'hack@x.com' })
r.headers.get('authorization')
const jLogin = await fetch(base + '/api/comments', {
  method: 'POST',
  headers: { ...auth },
  body: JSON.stringify({ path: '/md5', content: '登录用户测试', nickname: 'hack', email: 'hack@x.com' }),
}).then((x) => x.json())
check('8 登录用户身份', jLogin.data.nickname === '123' && jLogin.data.status === 'pending', `nickname=${jLogin.data.nickname}（应取数据库账号昵称而非游客传入的 hack）`)

// 9. 恢复 giscus + 清理测试数据
await adminPut('/api/admin/site-config', { comment_system: 'giscus', giscus_repo: '' })
for (const cid of [id, jLogin.data.id]) await adminDelete('/api/admin/comments/' + cid)
console.log('清理完成')

process.exit(failed ? 1 : 0)
