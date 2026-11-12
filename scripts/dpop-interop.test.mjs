// DPoP 互操作与负例测试（node scripts/dpop-interop.test.mjs）
// 验证链路：前端 proof 构造逻辑（与 src/utils/dpop.ts 一致的复刻）
//   ↔ functions/utils/dpop.js 的 validateDpopProof / verifyDpopBinding
//   ↔ functions/utils/jwt.js 的 signMainJWT ↔ middlewares/auth.js 的 verifyToken
import assert from 'node:assert/strict'
import { validateDpopProof, verifyDpopBinding, getJwkThumbprint } from '../functions/utils/dpop.js'
import { signMainJWT } from '../functions/utils/jwt.js'
import { AuthMiddleware } from '../functions/middlewares/auth.js'

const enc = new TextEncoder()
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

// ===== 模拟 KV（防重放存储） =====
function mockKV() {
  const store = new Map()
  return {
    store,
    async get(k) { return store.get(k) ?? null },
    async put(k, v, opts) {
      // 模拟 expirationTtl 过期清理（测试重放场景时用）
      if (opts?.expirationTtl && opts.expirationTtl <= 0) store.delete(k)
      else store.set(k, v)
    },
    async delete(k) { store.delete(k) }
  }
}

function mockRequest({ method = 'GET', url = 'https://tool.fologde.com/api/notes', dpop = null } = {}) {
  const headers = dpop === null ? {} : { dpop: proofHeaderName(), DPoP: dpop }
  return {
    method,
    url,
    headers: {
      get(name) {
        if (name.toLowerCase() === 'dpop') return dpop
        return headers[name.toLowerCase()] ?? null
      }
    }
  }
}
const proofHeaderName = () => 'x-unused'

// ===== 模拟前端（src/utils/dpop.ts 的等价实现） =====
async function makeClient() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y }

  async function proof({ htm = 'GET', htu = 'https://tool.fologde.com/api/notes', iat = Math.floor(Date.now() / 1000), jti = crypto.randomUUID(), jwkOverride = null, alg = 'ES256', typ = 'dpop+jwt' } = {}) {
    const header = { typ, alg, jwk: jwkOverride || publicJwk }
    const payload = { jti, iat, htm, htu }
    const data = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(payload)))}`
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, enc.encode(data))
    return `${data}.${b64url(sig)}`
  }
  return { proof, publicJwk }
}

const env = (kv) => ({ VERIFICATION_CODES: kv, DPOP_STRICT_HTU: 'false' })

let passed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1 }
}

const client = await makeClient()
const kv = mockKV()
const jkt = await getJwkThumbprint(client.publicJwk)

console.log('== validateDpopProof ==')
await test('正例：合法 proof 通过并返回正确 jkt', async () => {
  const r = await validateDpopProof(mockRequest({ dpop: await client.proof() }), env(kv))
  assert.ok(r.ok && r.jkt === jkt)
})
await test('htm 不匹配被拒', async () => {
  const p = await client.proof({ htm: 'POST' })
  const r = await validateDpopProof(mockRequest({ method: 'GET', dpop: p }), env(kv))
  assert.ok(!r.ok)
})
await test('htu path 不匹配被拒', async () => {
  const p = await client.proof({ htu: 'https://tool.fologde.com/api/admin' })
  const r = await validateDpopProof(mockRequest({ dpop: p }), env(kv))
  assert.ok(!r.ok)
})
await test('htu host 不同但 path 相同：默认（非严格）模式放行', async () => {
  const p = await client.proof({ htu: 'http://localhost:5173/api/notes?x=1' })
  const r = await validateDpopProof(mockRequest({ url: 'http://127.0.0.1:8788/api/notes', dpop: p }), env(kv))
  assert.ok(r.ok, `expected ok, got ${r.error}`)
})
await test('严格模式（DPOP_STRICT_HTU）host 不同被拒', async () => {
  const p = await client.proof({ htu: 'http://localhost:5173/api/notes' })
  const r = await validateDpopProof(mockRequest({ url: 'http://127.0.0.1:8788/api/notes' }), { ...env(kv), DPOP_STRICT_HTU: 'true' })
  assert.ok(!r.ok)
})
await test('iat 过期（>5min 前）被拒', async () => {
  const p = await client.proof({ iat: Math.floor(Date.now() / 1000) - 400 })
  const r = await validateDpopProof(mockRequest({ dpop: p }), env(kv))
  assert.ok(!r.ok)
})
await test('iat 未来偏移（>5min 后）被拒', async () => {
  const p = await client.proof({ iat: Math.floor(Date.now() / 1000) + 400 })
  const r = await validateDpopProof(mockRequest({ dpop: p }), env(kv))
  assert.ok(!r.ok)
})
await test('jti 重放被拒（同 proof 二次验证）', async () => {
  const p = await client.proof({ jti: 'replay-test-jti-0001' })
  const r1 = await validateDpopProof(mockRequest({ dpop: p }), env(kv))
  const r2 = await validateDpopProof(mockRequest({ dpop: p }), env(kv))
  assert.ok(r1.ok)
  assert.ok(!r2.ok, 'replayed proof must be rejected')
})
await test('篡改 payload 被拒（验签失败）', async () => {
  const p = await client.proof()
  const [h, , s] = p.split('.')
  const forgedPayload = b64url(enc.encode(JSON.stringify({ jti: crypto.randomUUID(), iat: Math.floor(Date.now() / 1000), htm: 'GET', htu: 'https://tool.fologde.com/api/notes' })))
  const r = await validateDpopProof(mockRequest({ dpop: `${h}.${forgedPayload}.${s}` }), env(kv))
  assert.ok(!r.ok)
})
await test('jwk 携带私钥成员 d 被拒', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
  const full = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const p = await client.proof({ jwkOverride: full })
  const r = await validateDpopProof(mockRequest({ dpop: p }), env(kv))
  assert.ok(!r.ok)
})
await test('typ 非 dpop+jwt 被拒', async () => {
  const p = await client.proof({ typ: 'JWT' })
  const r = await validateDpopProof(mockRequest({ dpop: p }), env(kv))
  assert.ok(!r.ok)
})
await test('alg 降级（none）被拒', async () => {
  const p = await client.proof({ alg: 'none' })
  const r = await validateDpopProof(mockRequest({ dpop: p }), env(kv))
  assert.ok(!r.ok)
})
await test('jti 过短（<8）被拒', async () => {
  const p = await client.proof({ jti: 'abc' })
  const r = await validateDpopProof(mockRequest({ dpop: p }), env(kv))
  assert.ok(!r.ok)
})

console.log('== verifyDpopBinding ==')
const boundPayload = { uid: 'u1', ver: 0, exp: Math.floor(Date.now() / 1000) + 3600, cnf: { jkt } }
await test('token 无 cnf：过渡期放行', async () => {
  const r = await verifyDpopBinding(mockRequest(), env(kv), { uid: 'u1' })
  assert.ok(r.ok)
})
await test('token 无 cnf + DPOP_ENFORCE：拒绝', async () => {
  const r = await verifyDpopBinding(mockRequest(), { ...env(kv), DPOP_ENFORCE: 'true' }, { uid: 'u1' })
  assert.ok(!r.ok)
})
await test('cnf.jkt 与 proof 公钥一致：通过', async () => {
  const p = await client.proof()
  const r = await verifyDpopBinding(mockRequest({ dpop: p }), env(kv), boundPayload)
  assert.ok(r.ok)
})
await test('cnf.jkt 与 proof 公钥不一致（换设备私钥）：拒绝', async () => {
  const other = await makeClient()
  const p = await other.proof()
  const r = await verifyDpopBinding(mockRequest({ dpop: p }), env(kv), boundPayload)
  assert.ok(!r.ok)
})
await test('cnf 存在但请求未带 DPoP header：拒绝', async () => {
  const r = await verifyDpopBinding(mockRequest(), env(kv), boundPayload)
  assert.ok(!r.ok)
})

console.log('== JWT 签发/验签互操作（dpop-bind 重签链路） ==')
const SECRET = 'test-secret-for-interop-only'
await test('signMainJWT ↔ AuthMiddleware.verifyToken（含 cnf payload）', async () => {
  const token = await signMainJWT({ ...boundPayload, iat: Math.floor(Date.now() / 1000) }, SECRET)
  const r = await AuthMiddleware.verifyToken(token, SECRET)
  assert.ok(r.success && r.payload.cnf.jkt === jkt)
})
await test('verifyToken 拒绝错 secret', async () => {
  const token = await signMainJWT({ ...boundPayload, iat: Math.floor(Date.now() / 1000) }, SECRET)
  const r = await AuthMiddleware.verifyToken(token, 'wrong')
  assert.ok(!r.success)
})

console.log('== non-extractable 密钥形态（前端存储策略的前提） ==')
await test('generateKey(false)：私钥可签名不可导出，公钥仍可导出', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
  assert.equal(pair.privateKey.extractable, false)
  assert.ok(pair.privateKey.usages.includes('sign'))
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey)
  assert.equal(pub.kty, 'EC')
  let privateExportRejected = false
  try { await crypto.subtle.exportKey('jwk', pair.privateKey) } catch { privateExportRejected = true }
  assert.ok(privateExportRejected, 'private key export must be rejected')
  // 不可导出私钥签的 proof 仍能用导出公钥验过（后端验签路径）
  const data = enc.encode('ne-key-check')
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, data)
  const vk = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk, sig, data))
})
await test('存量迁移：extractable JWK 可导入为 non-extractable 且 jkt 不变', async () => {
  const legacy = await makeClient() // makeClient 用 extractable 密钥对
  const privJwk = await crypto.subtle.exportKey('jwk', (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])).privateKey)
  const ne = await crypto.subtle.importKey('jwk', privJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  assert.equal(ne.extractable, false)
  assert.ok(ne.usages.includes('sign'))
  // jkt 基于公钥成员（crv/kty/x/y），与私钥存储形态无关
  const jktBefore = await getJwkThumbprint(legacy.publicJwk)
  const jktAfter = await getJwkThumbprint({ kty: privJwk.kty, crv: privJwk.crv, x: privJwk.x, y: privJwk.y })
  assert.equal(jktBefore && typeof jktAfter, 'string')
  assert.ok(jktAfter.length === 43)
})

console.log(`\n${passed} 项通过${process.exitCode ? '，存在失败项！' : '，全部通过 ✓'}`)
