// PBKDF2-SHA256 密码哈希（2026-10 安全加固）
//
// 历史格式：user.password = SHA-256(password + salt) 的小写十六进制（64 位、无前缀）。
// 新格式：user.password = 'pbkdf2$<迭代次数>$<hex>'，盐沿用 user.salt 列。
// 登录验证旧格式成功后由调用方透明升级为新格式（见 email-password-login.js）。

import { secureCompare } from './secure-compare.js'

const PBKDF2_ITERATIONS = 100000

const enc = new TextEncoder()

const toHex = (buf) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations },
    key,
    256,
  )
  return toHex(bits)
}

/**
 * 生成新格式哈希。salt 省略时自动生成（crypto.randomUUID）。
 * 返回 { salt, hash }，调用方分别写入 user.salt / user.password。
 */
export async function hashPassword(password, salt = crypto.randomUUID()) {
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return { salt, hash: `pbkdf2$${PBKDF2_ITERATIONS}$${hash}` }
}

/**
 * 验证密码。storedHash 为 user.password 列的值。
 * 返回 { valid, legacy }：legacy=true 表示命中的是旧 SHA-256 格式，
 * 调用方应在登录成功后用 hashPassword 重写以完成升级。
 */
export async function verifyPassword(password, storedHash, salt) {
  if (!storedHash || typeof storedHash !== 'string') return { valid: false, legacy: false }

  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$')
    const iterations = parseInt(parts[1], 10)
    const hex = parts[2]
    if (!Number.isInteger(iterations) || iterations < 1 || !/^[0-9a-f]{64}$/.test(hex || '')) {
      return { valid: false, legacy: false }
    }
    const computed = await pbkdf2(password, salt || '', iterations)
    return { valid: secureCompare(computed, hex), legacy: false }
  }

  // 旧格式：SHA-256(password + salt) 小写十六进制
  if (!/^[0-9a-f]{64}$/.test(storedHash)) return { valid: false, legacy: false }
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(password + (salt || '')))
  return { valid: secureCompare(toHex(digest), storedHash), legacy: true }
}
