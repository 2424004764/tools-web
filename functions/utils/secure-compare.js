// 恒时字符串比较：用于密钥/哈希比对，避免 === 的短路行为通过响应时间
// 逐字节泄露秘密内容（长度差异本身提前返回是可接受的——长度不属于秘密）。
// 适用场景：X-Cron-Secret、OAuth client_secret、密码哈希比较。

export function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b === 'undefined' || b === null) return false
  const strB = String(b)
  const max = Math.max(a.length, strB.length)
  let diff = a.length ^ strB.length
  for (let i = 0; i < max; i++) {
    // charCodeAt 越界返回 NaN，归零后参与异或，保证循环时长与内容无关
    diff |= (a.charCodeAt(i) || 0) ^ (strB.charCodeAt(i) || 0)
  }
  return diff === 0
}
