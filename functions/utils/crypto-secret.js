// AES-GCM 加密工具 - 用于加密存储 OSS AccessKey Secret
// 密钥派生与 JWT 签名密钥域分离（v2）：优先使用独立的 ENCRYPTION_SECRET，
// 未配置时回退 JWT_SECRET，但加域标签派生，避免签名密钥同时充当加密密钥。
// v1（历史）：直接 SHA-256(JWT_SECRET)，仅用于解密存量密文，不再新写。

const enc = new TextEncoder()
const dec = new TextDecoder()

// base64 helpers
const b64encode = (buf) => {
  const bytes = new Uint8Array(buf)
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str)
}

const b64decode = (b64) => {
  const str = atob(b64)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes.buffer
}

// 把任意字符串派生为 32 字节 AES key
async function deriveKey(secret, version) {
  // v2 加域标签：即使回退到 JWT_SECRET，派生结果也与签名密钥的原始用途隔离
  const material = version === 2 ? `tools-web/aes-gcm/v2:${secret || ''}` : (secret || '')
  const data = enc.encode(material)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * 加密明文 -> 带 v2 前缀的 base64 字符串（iv 拼接在密文前）
 * 输出格式: 'v2:' + base64(iv(12) || ciphertext+tag)
 */
export async function encryptSecret(plaintext, secret) {
  if (plaintext == null) return ''
  const key = await deriveKey(secret, 2)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(String(plaintext))
  )
  const out = new Uint8Array(iv.byteLength + cipherBuf.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(cipherBuf), iv.byteLength)
  return 'v2:' + b64encode(out.buffer)
}

/**
 * 解密 -> 明文。带 'v2:' 前缀用 v2 派生；无前缀为存量 v1 密文，
 * 用旧的 SHA-256(secret) 直接派生，保证升级后旧数据仍可读。
 */
export async function decryptSecret(payload, secret) {
  if (!payload) return ''
  const version = payload.startsWith('v2:') ? 2 : 1
  const data = version === 2 ? payload.slice(3) : payload
  try {
    const buf = b64decode(data)
    const iv = new Uint8Array(buf, 0, 12)
    const cipherBuf = buf.slice(12)
    const key = await deriveKey(secret, version)
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBuf
    )
    return dec.decode(plainBuf)
  } catch (e) {
    throw new Error('解密失败：' + e.message)
  }
}

/**
 * 遮蔽敏感信息（用于前端展示，前 4 后 4 中间 ***）
 */
export function maskSecret(secret) {
  if (!secret) return ''
  const s = String(secret)
  if (s.length <= 8) return '****'
  return s.slice(0, 4) + '****' + s.slice(-4)
}