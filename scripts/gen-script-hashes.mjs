// CSP 内联脚本 hash 生成器（2026-10 安全加固：script-src 移除 'unsafe-inline'）
//
// 作用：构建完成后扫描 dist 下所有 HTML（index.html + prerender 产物），
// 提取每个「可执行」内联 <script>（无 src、type 为 JS 类型；ld+json 等
// data block 不执行、不需要 hash）的精确文本，计算 sha256-base64 hash，
// 并把 dist/_headers 里 Content-Security-Policy 的 script-src 指令中的
// 旧 'sha256-*' token 整体替换为本次产物的新 hash 列表。
//
// 已由 build:pro / build:pro:fast 在 prerender 之后自动执行。
// ⚠️ 若手改了 index.html 的内联脚本，必须重新走一遍完整构建再部署，
//    否则线上 CSP hash 过期，内联脚本会被浏览器静默拦截（版本守卫失效）。
//
// 注意：hash 覆盖 <script> 与 </script> 之间的原始文本（含换行与缩进，
// 构建产物为 CRLF 也会原样计入），浏览器按同样字节计算，二者天然一致。

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// 浏览器视为「可执行」的 script type（缺省视为 JS）
const EXECUTABLE_TYPES = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
  'text/ecmascript',
  'application/ecmascript',
])

function listHtmlFiles(dir, out = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name)
    if (name.isDirectory()) {
      // 跳过 functions 同步产物与第三方依赖目录
      if (name.name === 'functions' || name.name === 'node_modules') continue
      listHtmlFiles(full, out)
    } else if (name.name.endsWith('.html')) {
      out.push(full)
    }
  }
  return out
}

function collectInlineScripts(html) {
  const scripts = []
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g
  let m
  while ((m = re.exec(html))) {
    const attrs = m[1] || ''
    const body = m[2]
    if (/\bsrc\s*=/.test(attrs)) continue // 外链脚本走 'self'/域名白名单
    const typeMatch = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)
    const type = typeMatch ? typeMatch[1].toLowerCase() : ''
    if (!EXECUTABLE_TYPES.has(type)) continue // ld+json / importmap 等不执行
    scripts.push(body)
  }
  return scripts
}

const headersPath = join(process.cwd(), 'dist', '_headers')
if (!existsSync(headersPath)) {
  console.error('[gen-script-hashes] dist/_headers 不存在，请确认 vite build 已把 public/ 拷进 dist')
  process.exit(1)
}

const htmlFiles = listHtmlFiles(join(process.cwd(), 'dist'))
if (!htmlFiles.length) {
  console.error('[gen-script-hashes] dist 下没有 HTML 文件，检查构建产物')
  process.exit(1)
}

const hashSamples = new Map() // hash -> [文件:预览]
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  for (const body of collectInlineScripts(html)) {
    const hash = 'sha256-' + createHash('sha256').update(body, 'utf8').digest('base64')
    if (!hashSamples.has(hash)) hashSamples.set(hash, [])
    if (hashSamples.get(hash).length < 3) {
      const preview = body.replace(/\s+/g, ' ').trim().slice(0, 72)
      hashSamples.get(hash).push(`${file.replace(/^.*dist[\\/]/, '')}: ${preview}…`)
    }
  }
}

const tokens = [...hashSamples.keys()].map((h) => `'${h}'`)
console.log(`[gen-script-hashes] 扫描 ${htmlFiles.length} 个 HTML，发现 ${hashSamples.size} 个内联脚本 hash：`)
for (const [hash, samples] of hashSamples) {
  console.log(`  ${hash}`)
  for (const s of samples) console.log(`      ${s}`)
}

let headers = readFileSync(headersPath, 'utf8')
const cspLineIndex = headers.split('\n').findIndex((l) => l.trim().startsWith('Content-Security-Policy:'))
if (cspLineIndex === -1) {
  console.error('[gen-script-hashes] _headers 里找不到 Content-Security-Policy 行')
  process.exit(1)
}
const lines = headers.split('\n')
let csp = lines[cspLineIndex]
if (!/\bscript-src\b/.test(csp)) {
  console.error('[gen-script-hashes] CSP 里找不到 script-src 指令')
  process.exit(1)
}

// 去掉旧的 sha256 token 与 public/_headers 里的占位 token，再把新 token 插到 script-src 之后
csp = csp
  .replace(/'(?:sha256-[A-Za-z0-9+/=]*|PLACEHOLDER-REPLACED-BY-BUILD)'/g, '')
  .replace(/\s{2,}/g, ' ')
if (tokens.length) {
  csp = csp.replace(/script-src\s+/i, `script-src ${tokens.join(' ')} `)
} else {
  console.warn('[gen-script-hashes] ⚠️ 本次产物没有任何内联脚本（若非刻意移除请人工确认）')
}
lines[cspLineIndex] = csp
writeFileSync(headersPath, lines.join('\n'))
console.log(`[gen-script-hashes] 已回写 dist/_headers 的 script-src（${tokens.length} 个 hash）`)
