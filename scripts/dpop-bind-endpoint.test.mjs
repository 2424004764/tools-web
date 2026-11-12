// /api/auth/dpop-bind 端点级测试（node scripts/dpop-bind-endpoint.test.mjs）
// 用真实模块 import 链 + mock D1/KV 跑 onRequest 全流程，验证：
// 无 cnf token 绑定、幂等重绑、防降级改绑、缺 proof 拒绝、方法限制
import assert from 'node:assert/strict'
import { onRequest } from '../functions/api/auth/dpop-bind.js'
import { AuthMiddleware } from '../functions/middlewares/auth.js'
import { signMainJWT } from '../functions/utils/jwt.js'
import { getJwkThumbprint } from '../functions/utils/dpop.js'

const enc = new TextEncoder()
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
const SECRET = 'dpop-bind-e2e-secret'

function mockKV() {
  const store = new Map()
  return {
    async get(k) { return store.get(k) ?? null },
    async put(k, v) { store.set(k, v) },
    async delete(k) { store.delete(k) }
  }
}

// mock D1：只支持 user 表主键查询（checkUserTokenState 用）
function mockDB(userRow = { token_version: 0, is_disabled: 0 }) {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() { return userRow },
            async run() { return {} }
          }
        }
      }
    }
  }
}

async function makeClient() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y }
  return {
    publicJwk,
    jkt: await getJwkThumbprint(publicJwk),
    async proof(htu = 'https://tool.fologde.com/api/auth/dpop-bind') {
      const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: publicJwk }
      const payload = { jti: crypto.randomUUID(), iat: Math.floor(Date.now() / 1000), htm: 'POST', htu }
      const data = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(payload)))}`
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, enc.encode(data))
      return `${data}.${b64url(sig)}`
    }
  }
}

const env = { JWT_SECRET: SECRET, VERIFICATION_CODES: mockKV(), DB: mockDB() }
const bindUrl = 'https://tool.fologde.com/api/auth/dpop-bind'
const basePayload = {
  uid: 'u-e2e', email: 'e@x.com', username: 'tester', avatar: null,
  is_admin: 0, ver: 0,
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 3600
}

function makeRequest(token, dpop, method = 'POST') {
  const headers = { Authorization: `Bearer ${token}` }
  if (dpop) headers.DPoP = dpop
  return new Request(bindUrl, { method, headers })
}

let passed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1 }
}

const client = await makeClient()

await test('无 cnf token + 有效 proof：返回带 cnf.jkt 的新 token（exp/ver 保留）', async () => {
  const oldToken = await signMainJWT(basePayload, SECRET)
  const res = await onRequest({ request: makeRequest(oldToken, await client.proof()), env })
  assert.equal(res.status, 200)
  const body = await res.json()
  const vr = await AuthMiddleware.verifyToken(body.token, SECRET)
  assert.ok(vr.success, 'new token must verify')
  assert.equal(vr.payload.cnf.jkt, client.jkt)
  assert.equal(vr.payload.exp, basePayload.exp, 'exp preserved')
  assert.equal(vr.payload.ver, basePayload.ver, 'ver preserved')
  assert.equal(vr.payload.uid, basePayload.uid)
})

await test('已绑定 token + 同钥 proof：幂等返回原 token', async () => {
  const boundToken = await signMainJWT({ ...basePayload, cnf: { jkt: client.jkt } }, SECRET)
  const res = await onRequest({ request: makeRequest(boundToken, await client.proof()), env })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.token, boundToken, 'must return the same token, no re-signing')
})

await test('已绑定 token + 他人密钥 proof：401 拒绝（防改绑）', async () => {
  const boundToken = await signMainJWT({ ...basePayload, cnf: { jkt: client.jkt } }, SECRET)
  const attacker = await makeClient()
  const res = await onRequest({ request: makeRequest(boundToken, await attacker.proof()), env })
  assert.equal(res.status, 401)
})

await test('无 cnf token 但缺 DPoP header：401 拒绝', async () => {
  const oldToken = await signMainJWT(basePayload, SECRET)
  const res = await onRequest({ request: makeRequest(oldToken, null), env })
  assert.equal(res.status, 401)
})

await test('token 无效（错 secret 签发）：401 拒绝', async () => {
  const forged = await signMainJWT(basePayload, 'wrong-secret')
  const res = await onRequest({ request: makeRequest(forged, await client.proof()), env })
  assert.equal(res.status, 401)
})

await test('用户 token_version 已变化（改密后旧 token）：401 拒绝', async () => {
  const envRotated = { ...env, DB: mockDB({ token_version: 1, is_disabled: 0 }) }
  const oldToken = await signMainJWT(basePayload, SECRET)
  const res = await onRequest({ request: makeRequest(oldToken, await client.proof()), env: envRotated })
  assert.equal(res.status, 401)
})

await test('GET 方法：405 拒绝', async () => {
  const oldToken = await signMainJWT(basePayload, SECRET)
  const res = await onRequest({ request: makeRequest(oldToken, null, 'GET'), env })
  assert.equal(res.status, 405)
})

console.log(`\n${passed} 项通过${process.exitCode ? '，存在失败项！' : '，全部通过 ✓'}`)
