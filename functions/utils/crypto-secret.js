// AES-GCM 加密工具 - 用于加密存储 OSS AccessKey Secret
// 派生密钥来源：env.JWT_SECRET，使用 SHA-256 派生固定 32 字节密钥

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
async function deriveKey(secret) {
  const data = enc.encode(secret || '')
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
 * 加密明文 -> base64 字符串（iv 拼接在密文前）
 * 输出格式: base64(iv(12) || ciphertext+tag)
 */
export async function encryptSecret(plaintext, jwtSecret) {
  if (plaintext == null) return ''
  const key = await deriveKey(jwtSecret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(String(plaintext))
  )
  const out = new Uint8Array(iv.byteLength + cipherBuf.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(cipherBuf), iv.byteLength)
  return b64encode(out.buffer)
}

/**
 * 解密 base64 字符串 -> 明文
 */
export async function decryptSecret(payload, jwtSecret) {
  if (!payload) return ''
  try {
    const buf = b64decode(payload)
    const iv = new Uint8Array(buf, 0, 12)
    const cipherBuf = buf.slice(12)
    const key = await deriveKey(jwtSecret)
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