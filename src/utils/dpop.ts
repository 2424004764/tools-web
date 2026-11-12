/**
 * DPoP（RFC 9449）前端实现：每台设备一对 ES256 密钥，每次请求现签 proof。
 *
 * - proof 结构：header {typ:'dpop+jwt', alg:'ES256', jwk:公钥}，
 *   payload {jti:一次性随机, iat, htm:请求方法, htu:请求地址(无query)}。
 * - 公钥指纹（jkt）经 /api/auth/dpop-bind 绑定进 JWT 的 cnf.jkt，
 *   ensureDpopBound() 在启动/登录后自动把无 cnf 的 token 升级为绑定 token。
 *
 * 私钥存储策略（XSS 抗性是核心设计目标）：
 * - 首选 non-extractable CryptoKey 存 IndexedDB（CryptoKey 支持 structured
 *   clone）：取出后可签名、永久无法导出密钥材料。即便 token 和存储都被
 *   XSS 读取，攻击者也拿不走私钥本体——token 单独在手即废纸，损失窗口
 *   从"token 有效期(7天)"缩到"受感染页面存活期间"。
 *   注：generateKey 传 extractable=false 后公钥仍可导出（WebCrypto 规范），
 *   proof header 需要的公钥 JWK 不受影响。
 * - 存量迁移：旧版把 extractable JWK 存 localStorage（key: DPOP_KEY）。
 *   读到时用 importKey(..., extractable:false) 转为不可导出键写入 IndexedDB，
 *   并删除 localStorage 副本（公钥 x/y 不变 → jkt 不变 → 已绑定 token 无感）。
 * - 降级：IndexedDB 不可用（极旧浏览器/隐私模式）时退回 localStorage JWK，
 *   行为与旧版一致；探测结果会话内缓存，不会每请求重复探测。
 * - 已知天花板：驻留 XSS 可在会话内驱动浏览器代签 proof 或直接发请求，
 *   软件密钥无法防御，只有 WebAuthn/硬件密钥能突破。
 */
import { getLocalToken, parseJwt, isTokenExpired } from './user'

const LEGACY_LS_KEY = 'DPOP_KEY'
const DB_NAME = 'tools-web-dpop'
const DB_VERSION = 1
const STORE = 'keys'
const RECORD_ID = 'dpop-main'
// IndexedDB open 超时：拦截器每个请求都要签名，IDB 卡死不能拖垮全站请求
const IDB_OPEN_TIMEOUT_MS = 2000

interface EcPublicJwk {
  kty: 'EC'
  crv: 'P-256'
  x: string
  y: string
}

interface EcPrivateJwk extends EcPublicJwk {
  d: string
}

interface KeyMaterial {
  privateKey: CryptoKey
  publicJwk: EcPublicJwk
}

const EC_ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const

let keyMaterialPromise: Promise<KeyMaterial> | null = null
// IndexedDB 可用性探测结果（null = 未探测）。探测失败后会话内不再重试
let idbUsable: boolean | null = null

function b64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function textB64url(text: string): string {
  return b64urlEncode(new TextEncoder().encode(text))
}

// ===== IndexedDB 最小封装（单记录读写） =====

function openDpopDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    let settled = false
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        request.onerror = null
        request.onsuccess = null
        try { request.transaction?.abort() } catch { /* ignore */ }
        reject(new Error('IndexedDB open timeout'))
      }
    }, IDB_OPEN_TIMEOUT_MS)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve(request.result)
      }
    }
    request.onerror = () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(request.error || new Error('IndexedDB open failed'))
      }
    }
    request.onblocked = () => {
      // 其他标签页持有旧版本连接：按超时处理走降级，不无限等待
    }
  })
}

async function idbGet(): Promise<KeyMaterial | null> {
  const db = await openDpopDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(RECORD_ID)
    req.onsuccess = () => {
      const v = req.result as KeyMaterial | undefined
      // 存储的 CryptoKey 可能因浏览器数据清理而失效：校验形状后再信任
      if (
        v && v.privateKey && v.privateKey.type === 'private' &&
        (v.privateKey.algorithm as { namedCurve?: string })?.namedCurve === 'P-256' &&
        Array.isArray(v.privateKey.usages) && v.privateKey.usages.includes('sign') &&
        v.publicJwk?.x && v.publicJwk?.y
      ) {
        resolve(v)
      } else {
        resolve(null)
      }
    }
    req.onerror = () => reject(req.error || new Error('idb get failed'))
  })
}

async function idbPut(material: KeyMaterial): Promise<void> {
  const db = await openDpopDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(material, RECORD_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('idb put failed'))
    tx.onabort = () => reject(tx.error || new Error('idb put aborted'))
  })
}

// ===== 密钥获取：IndexedDB → 存量迁移 → 现生成，逐级降级 =====

function parseStoredJwk(raw: string): EcPrivateJwk | null {
  try {
    const jwk = JSON.parse(raw) as EcPrivateJwk
    if (jwk.kty === 'EC' && jwk.crv === 'P-256' && jwk.d && jwk.x && jwk.y) return jwk
  } catch {
    /* 损坏数据按不存在处理 */
  }
  return null
}

async function loadOrCreate(): Promise<KeyMaterial> {
  // ① 首选：IndexedDB 中的 non-extractable CryptoKey
  if (idbUsable !== false) {
    try {
      const stored = await idbGet()
      if (stored) return stored

      // ② 存量迁移：localStorage 的 extractable JWK → 不可导出键入 IndexedDB
      //    （x/y 不变 → jkt 不变 → 已绑定 token 无感迁移），随后删除盘上 JWK
      const legacyRaw = localStorage.getItem(LEGACY_LS_KEY)
      if (legacyRaw) {
        const jwk = parseStoredJwk(legacyRaw)
        if (jwk) {
          const privateKey = await crypto.subtle.importKey('jwk', jwk, EC_ALG, false, ['sign'])
          const material: KeyMaterial = {
            privateKey,
            publicJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }
          }
          await idbPut(material)
          localStorage.removeItem(LEGACY_LS_KEY)
          return material
        }
        localStorage.removeItem(LEGACY_LS_KEY) // 损坏数据清掉
      }

      // ③ 全新生成：私钥不可导出；公钥按规范仍可导出（proof header 需要）
      const pair = await crypto.subtle.generateKey(EC_ALG, false, ['sign', 'verify'])
      const pub = await crypto.subtle.exportKey('jwk', pair.publicKey) as EcPublicJwk
      const material: KeyMaterial = {
        privateKey: pair.privateKey,
        publicJwk: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }
      }
      await idbPut(material)
      return material
    } catch (e) {
      // IndexedDB 读写任何环节失败：会话内降级到 localStorage 方案
      idbUsable = false
      console.warn('[dpop] IndexedDB unavailable, falling back to localStorage JWK:', e)
    }
  }

  // ④ 降级：localStorage（与旧版行为一致）
  const stored = localStorage.getItem(LEGACY_LS_KEY)
  if (stored) {
    const jwk = parseStoredJwk(stored)
    if (jwk) {
      // 内存中同样收紧为不可导出（盘上副本已存在，导出面只少不多）
      const privateKey = await crypto.subtle.importKey('jwk', jwk, EC_ALG, false, ['sign'])
      return { privateKey, publicJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } }
    }
    localStorage.removeItem(LEGACY_LS_KEY)
  }
  const pair = await crypto.subtle.generateKey(EC_ALG, true, ['sign', 'verify'])
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey) as EcPrivateJwk
  localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(privateJwk))
  return {
    privateKey: pair.privateKey,
    publicJwk: { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y }
  }
}

/** 取/生成设备密钥（单飞防并发） */
function getKeyMaterial(): Promise<KeyMaterial> {
  keyMaterialPromise ||= loadOrCreate().catch((error) => {
    // 失败不缓存，下次调用重试
    keyMaterialPromise = null
    throw error
  })
  return keyMaterialPromise
}

/** 为一次请求签 DPoP proof（htm 大写、htu 不含 query/hash） */
export async function createDpopProof(htm: string, htu: string): Promise<string> {
  const { privateKey, publicJwk } = await getKeyMaterial()
  const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: publicJwk }
  const payload = {
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    htm: htm.toUpperCase(),
    htu
  }
  const data = `${textB64url(JSON.stringify(header))}.${textB64url(JSON.stringify(payload))}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(data)
  )
  return `${data}.${b64urlEncode(new Uint8Array(signature))}`
}

/** 拼 axios 请求的最终 URL（baseURL + url，处理绝对/相对两种形式） */
export function joinUrl(base?: string, url?: string): string {
  const u = url || ''
  if (/^https?:\/\//i.test(u)) return u
  const b = (base || '').replace(/\/+$/, '')
  return b + '/' + u.replace(/^\/+/, '')
}

/**
 * 计算请求的 htu（去 query/hash）。
 * 供拦截器调用：htu 与后端 request.url 比对（默认只比 path，见 utils/dpop.js）
 */
export function buildRequestHtu(baseURL?: string, url?: string): string {
  return joinUrl(baseURL, url).replace(/[?#].*$/, '')
}

let bindingPromise: Promise<void> | null = null

/**
 * 惰性升级：本地 token 未绑定 DPoP（无 cnf.jkt）时，调 /api/auth/dpop-bind
 * 换取带 cnf.jkt 的新 token 并替换 localStorage。幂等、单飞、失败静默
 * （下次启动/登录重试）。用原生 fetch 而非 functionsRequest，避免循环依赖。
 */
export function ensureDpopBound(): Promise<void> {
  bindingPromise ||= (async () => {
    const token = getLocalToken()
    if (!token || isTokenExpired(token)) return
    if (parseJwt<{ cnf?: { jkt?: string } }>(token)?.cnf?.jkt) return

    const base = (import.meta.env.VITE_SITE_URL as string | undefined) || ''
    const htu = buildRequestHtu(base, '/api/auth/dpop-bind')
    const res = await fetch(htu, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        DPoP: await createDpopProof('POST', htu)
      }
    })
    if (!res.ok) return
    // ApiResponse.success 直接把 { token } 序列化为顶层 JSON（无 code/data 包裹）
    const body = await res.json().catch(() => null)
    const newToken: unknown = body?.token
    if (typeof newToken === 'string' && newToken.split('.').length === 3) {
      localStorage.setItem('TOKEN', newToken)
    }
  })().catch(() => {
    // 静默失败：无 cnf 的 token 过渡期仍可用，下次启动再试
  }).finally(() => {
    // 完成后清掉单飞句柄：登录换号等场景需要重新评估
    bindingPromise = null
  })
  return bindingPromise
}
