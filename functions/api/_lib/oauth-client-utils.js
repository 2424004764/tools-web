// OAuth 客户端管理共享工具（被 admin/oauth-clients 各路由文件引用）
// 注意：不要放路由文件里互相 import —— wrangler 打包器无法从 [id].js 解析 ../index.js

export function sanitizeText(value, max) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, max)
}

// 校验回调地址白名单：每行一个合法的 http(s) URL
export function normalizeRedirectUris(raw) {
  const lines = String(raw ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!lines.length) return { error: '至少需要一个回调地址' }
  for (const line of lines) {
    try {
      const u = new URL(line)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: `回调地址需为 http(s)：${line}` }
    } catch {
      return { error: `回调地址格式不合法：${line}` }
    }
  }
  if (new Set(lines).size !== lines.length) return { error: '回调地址不能重复' }
  if (lines.length > 20) return { error: '回调地址最多 20 个' }
  return { value: lines.join('\n') }
}

export function randomHex(bytes) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}
