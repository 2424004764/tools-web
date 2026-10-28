// crypto.randomUUID 需要 Chrome 92+ / Safari 15.4+，微信 X5 等老内核 WebView
// 和旧版 iOS Safari 上不存在，直接调用会抛 TypeError，把上传/生成整条链路打断
// （表现就是手机端点了上传没反应）。所有浏览器端 uuid 一律走这里。
export function genUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // 标成 RFC 4122 v4 版本位，格式与 randomUUID 完全一致
  bytes[6] = (bytes[6] & 0x3f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
