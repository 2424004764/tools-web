#!/usr/bin/env node
/**
 * 一键清理 Cloudflare Pages 边缘节点缓存。
 *
 * 使用场景：
 *   部署完代码变更，边缘节点还在用旧 HTML 响应，
 *   用户刷新看不到新版时，跑这个脚本强制清掉所有边缘缓存。
 *
 * 用法：
 *   1) 准备好环境变量（在 .env 或临时 export）：
 *        CLOUDFLARE_API_TOKEN   API Token，需要 Zone.Cache Purge 权限
 *        CLOUDFLARE_ZONE_ID     你的域名 zone ID（在 Cloudflare 控制台 Overview 右下角）
 *
 *   2) pnpm purge-cdn          清全部边缘节点
 *      pnpm purge-cdn /index.html /js/index-*.js
 *                              精确清指定路径（支持 glob）
 *
 * 不需要这两个变量时，直接打印命令让你手动跑：
 *   1. Cloudflare 后台 → Caching → Purge Cache → Purge Everything
 *   2. 或临时开 Development Mode 3 小时自动失效
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// 简单 .env 解析（不引入 dotenv）
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*["']?([^"'\n]+)["']?\s*$/i)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const ZONE  = process.env.CLOUDFLARE_ZONE_ID

const args = process.argv.slice(2)

console.log('\n🧹 Cloudflare Pages 边缘缓存清理')
console.log('━'.repeat(50))

// 没配置环境变量 → 打印手动操作指引
if (!TOKEN || !ZONE) {
  console.log('\n未检测到 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID。')
  console.log('\n最简办法（30 秒）：')
  console.log('  1. Cloudflare 控制台 → tool.fologde.com 域名')
  console.log('  2. Caching → Configuration → Development Mode → ON')
  console.log('     （开启后 3 小时边缘缓存全部 bypass）')
  console.log('  3. 等 30 秒，让用户刷新即可看到新版本')
  console.log('')
  console.log('永久方案（推荐）：')
  console.log('  Cloudflare 控制台 → Caching → Cache Rules')
  console.log('  Rule: URI Path equals "/index.html" → Bypass')
  console.log('')
  console.log('要自动化此脚本：')
  console.log('  1. https://dash.cloudflare.com/profile/api-tokens')
  console.log('     → Create Token → Edit zone cache purge → Zone Resources: tool.fologde.com')
  console.log('  2. 控制台右下角 Overview → Zone ID')
  console.log('  3. 在项目根目录 .env 添加：')
  console.log('       CLOUDFLARE_API_TOKEN=...')
  console.log('       CLOUDFLARE_ZONE_ID=...')
  process.exit(0)
}

// 有 API → 直接调
async function main() {
  let url, body
  if (args.length === 0) {
    console.log('\n→ Purge Everything (清全部边缘缓存)')
    url = `https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`
    body = { purge_everything: true }
  } else {
    // glob 展开（简单实现：只支持 * 一个通配符）
    const files = await expandGlobs(args)
    console.log(`\n→ Purge ${files.length} file(s):`)
    files.forEach(f => console.log(`   ${f}`))
    url = `https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`
    body = { files }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (json.success) {
    console.log('\n✅ 边缘缓存已清，等 30 秒让全球节点同步。')
    console.log('   然后让用户在手机上"强制停止 Chrome 后重开"即可。')
  } else {
    console.error('\n❌ 失败：')
    console.error(JSON.stringify(json.errors, null, 2))
    process.exit(1)
  }
}

// 简单 glob 展开（读取 dist 目录匹配）
async function expandGlobs(patterns) {
  const fs = await import('node:fs/promises')
  const result = new Set()
  for (const pat of patterns) {
    if (!pat.includes('*')) { result.add(pat); continue }
    // 展开通配符：扫描 dist 目录
    const prefix = pat.split('*')[0]
    const subdir = prefix.startsWith('/') ? prefix.slice(1).split('/')[0] : 'dist'
    const fullDir = resolve(process.cwd(), subdir)
    try {
      const entries = await collectFiles(fullDir, prefix)
      for (const f of entries) result.add(f)
    } catch (e) { /* ignore */ }
  }
  return Array.from(result)
}

async function collectFiles(dir, prefix) {
  const fs = await import('node:fs/promises')
  const out = []
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return [] }
  const prefixPath = prefix.replace(/\*/g, '.*')
  const re = new RegExp('^' + prefixPath)
  for (const e of entries) {
    const full = dir + '/' + e.name
    const rel = full.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '/')
    if (e.isDirectory()) {
      out.push(...(await collectFiles(full, prefix)))
    } else if (re.test(rel) || re.test('/' + rel)) {
      out.push('/' + rel)
    }
  }
  return out
}

main().catch(e => { console.error(e); process.exit(1) })
