// DPoP（RFC 9449）proof 验证与 JWT 发送方约束（sender-constraining）
//
// 背景：主站 JWT 为 HS256 bearer token，一旦被网络截获或从 localStorage 偷出，
// 任何人都能原样重放。DPoP 把 token 与客户端一对 ES256 密钥绑定：
//   1. 登录/升级时把客户端公钥指纹（RFC 7638 jkt）写入 JWT payload 的 cnf.jkt；
//   2. 此后每个请求携带 DPoP header：一个用私钥现签的 proof JWT
//      （header {typ:'dpop+jwt', alg:'ES256', jwk:公钥}，
//       payload {jti, iat, htm:请求方法, htu:请求地址}）；
//   3. 服务端验证 proof 签名 + htm/htu 匹配 + iat 时效 + jti 未重放，
//      且 proof 公钥指纹必须等于 token 内绑定的 cnf.jkt。
// 截获 token 而没有私钥的攻击者无法构造 proof，token 即失效。
//
// 设计取舍：
// - proof 只接受 ES256（P-256）：浏览器 Web Crypto 与 Workers 原生支持，proof 短；
//   显式拒绝其他 alg，防算法混淆（与 auth.js 锁 HS256 同理）。
// - htu 默认只比对 pathname：Cloudflare 反代 / vite dev proxy 下前端可见的
//   host 与后端 request.url 的 host 不保证一致（dev 相对路径经 5173 proxy 到 8788）。
//   绑定的安全价值主要来自密钥持有证明 + htm + jti 防重放；需要完整
//   origin+path 比对时可设 env.DPOP_STRICT_HTU = 'true'。
// - jti 防重放复用 VERIFICATION_CODES KV（键 dpop: 前缀隔离，见 rate-limit.js 先例）。
//   get→put 非原子，同 proof 毫秒级并发重放存在极小竞态窗口，可接受；
//   KV 故障时 fail-open（签名/htm/htu/iat 校验仍然生效，与限流模块哲学一致）。

// proof 允许的最大字符数：正常 proof < 1KB，超长直接拒绝，防滥用解析
const PROOF_MAX_LENGTH = 4096
// iat 容忍窗口（秒）：proof 必须在 [now-300, now+300] 内签发。
// 放宽到 ±5min 兼容客户端时钟小幅偏移；配合 jti 防重放，窗口大小不引入重放面
const IAT_WINDOW_SEC = 300
// jti 最长 128 字符（防 KV key 滥用），最短 8（防纯占位）
const JTI_MAX_LENGTH = 128
const JTI_MIN_LENGTH = 8
// P-256 公钥坐标：32 字节 → base64url 恰好 43 字符
const P256_COORD_B64_LENGTH = 43

function b64urlDecodeToBytes(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/')
  let padded = normalized
  while (padded.length % 4) padded += '='
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function b64urlEncodeBytes(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/**
 * RFC 7638 JWK thumbprint：对 EC 公钥必需成员 {crv,kty,x,y} 按字典序
 * 组成的无空白 JSON 做 SHA-256，结果 base64url。用作 token 的绑定指纹 jkt。
 */
export async function getJwkThumbprint(jwk) {
  // 对象字面量按字典序书写（crv < kty < x < y），JSON.stringify 保持插入序
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return b64urlEncodeBytes(digest)
}

// 校验 proof 内嵌公钥：只允许 P-256 公钥成员，禁止携带私钥成员 d
function parseEcPublicJwk(rawJwk) {
  if (!rawJwk || typeof rawJwk !== 'object') return null
  const { kty, crv, x, y } = rawJwk
  if (kty !== 'EC' || crv !== 'P-256') return null
  if (typeof x !== 'string' || x.length !== P256_COORD_B64_LENGTH) return null
  if (typeof y !== 'string' || y.length !== P256_COORD_B64_LENGTH) return null
  if ('d' in rawJwk) return null // proof 只能携带公钥（RFC 9449 §4.2）
  return { kty, crv, x, y }
}

// htu 与实际请求比对：解析为 URL 后去掉 query/fragment。
// 默认只比 pathname；DPOP_STRICT_HTU=true 时比 origin+pathname。
function htuMatches(htu, requestUrl, strict) {
  let claimed
  let actual
  try {
    claimed = new URL(htu)
    actual = new URL(requestUrl)
  } catch {
    return false
  }
  if (strict) return claimed.origin + claimed.pathname === actual.origin + actual.pathname
  return claimed.pathname === actual.pathname
}

/**
 * 验证请求携带的 DPoP proof。
 * @param {Request} request 实际请求（取 method/url/DPoP header）
 * @param {object} env Workers env（防重放用 env.VERIFICATION_CODES KV）
 * @returns {Promise<{ok: true, jkt: string} | {ok: false, error: string}>}
 *   jkt 为 proof 公钥指纹，供调用方与 token 的 cnf.jkt 比对
 */
export async function validateDpopProof(request, env) {
  const proof = request.headers.get('DPoP') || ''
  if (!proof) return { ok: false, error: 'missing DPoP proof' }
  if (proof.length > PROOF_MAX_LENGTH) return { ok: false, error: 'proof too large' }

  const parts = proof.split('.')
  if (parts.length !== 3) return { ok: false, error: 'invalid proof format' }
  const [headerB64, payloadB64, signatureB64] = parts

  let header
  let payload
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(headerB64)))
    payload = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(payloadB64)))
  } catch {
    return { ok: false, error: 'invalid proof encoding' }
  }

  // typ/alg 锁定：本系统只接受 ES256 的 dpop+jwt
  if (!header || header.typ !== 'dpop+jwt' || header.alg !== 'ES256') {
    return { ok: false, error: 'invalid proof typ/alg' }
  }

  const publicJwk = parseEcPublicJwk(header.jwk)
  if (!publicJwk) return { ok: false, error: 'invalid proof jwk' }

  // 用 proof 内嵌公钥验签（ES256 = ECDSA + SHA-256）
  let signatureValid = false
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      publicJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    )
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    signatureValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      b64urlDecodeToBytes(signatureB64),
      data
    )
  } catch {
    return { ok: false, error: 'proof verify error' }
  }
  if (!signatureValid) return { ok: false, error: 'invalid proof signature' }

  // payload 声明完整性
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'invalid proof payload' }
  const { jti, iat, htm, htu } = payload
  if (typeof jti !== 'string' || jti.length < JTI_MIN_LENGTH || jti.length > JTI_MAX_LENGTH) {
    return { ok: false, error: 'invalid proof jti' }
  }
  const now = Math.floor(Date.now() / 1000)
  if (typeof iat !== 'number' || iat < now - IAT_WINDOW_SEC || iat > now + IAT_WINDOW_SEC) {
    return { ok: false, error: 'proof expired' }
  }
  if (typeof htm !== 'string' || htm.toUpperCase() !== request.method) {
    return { ok: false, error: 'htm mismatch' }
  }
  if (typeof htu !== 'string' || !htuMatches(htu, request.url, String(env?.DPOP_STRICT_HTU || '').toLowerCase() === 'true')) {
    return { ok: false, error: 'htu mismatch' }
  }

  // jti 防重放：KV 内存在即视为重放。TTL 覆盖 iat 窗口 + KV 60s 下限。
  // 仅在签名与声明全部校验通过后才写入，攻击者无法用垃圾请求刷 KV。
  const kv = env?.VERIFICATION_CODES
  if (kv) {
    const kvKey = `dpop:jti:${jti}`
    try {
      const seen = await kv.get(kvKey)
      if (seen) return { ok: false, error: 'replayed proof jti' }
      await kv.put(kvKey, '1', { expirationTtl: IAT_WINDOW_SEC * 2 + 60 })
    } catch (e) {
      // fail-open：KV 故障不拖垮正常请求（签名/绑定校验仍完整生效）
      console.warn('[dpop] replay-check kv error:', e?.message || e)
    }
  }

  const jkt = await getJwkThumbprint(publicJwk)
  return { ok: true, jkt }
}

/**
 * 校验 JWT payload 与 DPoP proof 的绑定关系（鉴权链调用）。
 * - payload 含 cnf.jkt：必须携带有效 proof 且公钥指纹一致，否则拒绝；
 * - payload 无 cnf.jkt：过渡期放行（存量 token / 新登录未升级）。
 *   全量升级完成（旧 token 过期）后可设 env.DPOP_ENFORCE='true' 强制。
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
export async function verifyDpopBinding(request, env, payload) {
  const boundJkt = payload?.cnf?.jkt
  if (!boundJkt || typeof boundJkt !== 'string') {
    if (String(env?.DPOP_ENFORCE || '').toLowerCase() === 'true') {
      return { ok: false, error: '登录状态已失效，请重新登录' }
    }
    return { ok: true }
  }
  const proof = await validateDpopProof(request, env)
  if (!proof.ok) {
    console.warn(`[dpop] proof rejected: ${proof.error}`)
    return { ok: false, error: '登录状态已失效，请重新登录' }
  }
  if (proof.jkt !== boundJkt) {
    console.warn('[dpop] proof jkt mismatch with token cnf')
    return { ok: false, error: '登录状态已失效，请重新登录' }
  }
  return { ok: true }
}
