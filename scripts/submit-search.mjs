#!/usr/bin/env node
/**
 * 一键把 sitemap 里的 URL 推送到搜索引擎（百度 / IndexNow 覆盖 Bing/Yandex/Seznam/Naver）。
 *
 * 用法（在仓库根目录）：
 *   pnpm submit:search                # 增量推送：只推 7 天内没推过的 URL
 *   pnpm submit:search --force       # 强制全量推送（忽略本地快照）
 *   pnpm submit:search --dry-run     # 只打印将要推送的 URL，不真正请求
 *   pnpm submit:search --resubmit-days=3
 *                                   # 自定义"多少天内已推过的就不再推"，默认 7
 *
 * 同时会被 pnpm deploy:cf 在部署成功后自动调用。
 *
 * ---- 准备工作（首次）----
 * 1) 百度站长平台
 *    - 打开 https://ziyuan.baidu.com ，"站点管理 → 添加网站"验证 https://tool.fologde.com
 *    - 验证通过后 "链接提交 → 主动推送（实时）" 那一栏有 "接口调用地址"：
 *      http://data.zz.baidu.com/urls?site=https://tool.fologde.com&token=xxxxx
 *    - 把 token= 后面的字符串填到 .env 的 BAIDU_PUSH_TOKEN
 *
 * 2) IndexNow（Bing / Yandex / Seznam / Naver 一把 key 通用）
 *    - 生成 8~128 位随机字符串作为 key（随便写，比如 uuid 去掉横线）
 *    - 在站点根目录放一个纯文本文件 https://你的域名/<key>.txt，
 *      内容就是这个 key 本身（用来证明你拥有域名）
 *    - 把这个 key 填到 .env 的 INDEXNOW_KEY，并把可访问的 URL 填到 INDEXNOW_KEY_LOCATION
 *
 * 3) Google（不需要 token，但需要部署时把 sitemap.xml 上线到根域名）
 *    - 脚本会自动 ping Google "sitemap updated" 通知端。
 *    - 如果不想 ping Google，设 GOOGLE_PING_SITEMAP=0
 *
 * ---- 防误推（域名门禁）----
 * 拒绝把任何 host 是 localhost / 127.0.0.1 / *.local 的 URL 推到搜索引擎。
 * 这是各家搜索引擎都会拒绝、但不会提前告诉你的请求。
 *
 * ---- 增量推送快照 ----
 * 维护 .search-submissions.json，记录每条 URL 上次推送成功的 ISO 时间戳，
 * 默认 7 天内不重复推（可在命令行覆盖）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ── 简易 .env 解析（不引入 dotenv，跟 purge-cdn.mjs 风格一致） ──────────────
// 加载顺序：先纯 .env（最高优先），再 .env.production（deploy 走这条），
// 再 .env.development（兜底）。只填没设过的变量，避免覆盖。
const parseEnv = (path) => {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    // 支持 # 开头注释、key=前后可有空格、值可有引号也可无
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*["']?([^"'\n]+?)["']?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
parseEnv(resolve(process.cwd(), '.env'))
parseEnv(resolve(process.cwd(), '.env.production'))
parseEnv(resolve(process.cwd(), '.env.development'))

// ── 参数 ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flags = {
  force: args.includes('--force'),
  dryRun: args.includes('--dry-run'),
  push: args.includes('--push'),
  resubmitDays: (() => {
    const m = args.find(a => a.startsWith('--resubmit-days='))
    return m ? Number(m.split('=')[1]) : 7
  })(),
}

// 推送开关由命令行 --push 控制（pnpm deploy:cf --push 才会传过来）。
// 不带 --push 时按 dry-run 行为（只打印要推的 URL，不发请求），方便部署完看到列表。
const PUSH_ENABLED = flags.push
if (!PUSH_ENABLED && !flags.dryRun) {
  console.log('   ⏭️  未传 --push，按 dry-run 行为（不会真正推送）')
  console.log('      推送方式：pnpm deploy:cf --push')
  flags.dryRun = true
}
// 静默开关：开启推送时（带 --push）默认就静默；
// 只想看到推送结果设 SEARCH_PUSH_VERBOSE=1；未开启推送时一定打印引导。
const QUIET = PUSH_ENABLED && process.env.SEARCH_PUSH_VERBOSE !== '1'
const log = QUIET ? () => {} : (...a) => console.log(...a)

const SITE_ORIGIN  = process.env.SITE_ORIGIN
const BAIDU_TOKEN  = process.env.BAIDU_PUSH_TOKEN
const INDEXNOW_KEY = process.env.INDEXNOW_KEY
const INDEXNOW_KEY_LOC = process.env.INDEXNOW_KEY_LOCATION
const GOOGLE_PING  = (process.env.GOOGLE_PING_SITEMAP ?? '1') !== '0'

const SNAPSHOT_PATH = resolve(process.cwd(), '.search-submissions.json')
const SITEMAP_PATH  = resolve(process.cwd(), 'sitemap.xml')

log('\n🚀 搜索引擎主动推送')
log('━'.repeat(50))
log(`   SITE_ORIGIN    : ${SITE_ORIGIN || '(未配置)'}`)
log(`   百度推送        : ${BAIDU_TOKEN ? '✅' : '⏭️  未配置 token'}`)
log(`   IndexNow       : ${INDEXNOW_KEY ? '✅' : '⏭️  未配置 key'}`)
log(`   Google ping    : ${GOOGLE_PING ? '✅' : '⏭️  已关闭'}`)
log(`   重推周期        : ${flags.resubmitDays} 天  ${flags.force ? '(force 全量)' : ''}`)
if (flags.dryRun) log('   ⚠️  --dry-run 模式，不会真正请求')

// 配置缺失时即使在静默模式也要 warn（避免 token 漏配还蒙在鼓里）
if (PUSH_ENABLED) {
  if (!BAIDU_TOKEN && !INDEXNOW_KEY && GOOGLE_PING) {
    console.warn('⚠️ 启用了推送但未配置 BAIDU_PUSH_TOKEN / INDEXNOW_KEY，只有 Google ping 会执行')
  }
}

// ── 0. 前置检查：拒绝本地域名 ──────────────────────────────────────────────
if (!SITE_ORIGIN) {
  console.error('\n❌ 未配置 SITE_ORIGIN。\n   在 .env 添加：SITE_ORIGIN=https://tool.fologde.com')
  process.exit(1)
}
let siteUrl
try {
  siteUrl = new URL(SITE_ORIGIN)
} catch {
  console.error(`\n❌ SITE_ORIGIN 不是合法 URL: ${SITE_ORIGIN}`)
  process.exit(1)
}
const host = siteUrl.hostname
if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || host.endsWith('.local')) {
  console.error(`\n❌ SITE_ORIGIN 指向本地域名 (${host})，拒绝推送，避免污染搜索引擎数据。`)
  console.error('   部署到 Cloudflare 后再用生产域名跑这条命令。')
  process.exit(1)
}
if (siteUrl.protocol !== 'https:') {
  console.error(`\n❌ SITE_ORIGIN 必须使用 https：${SITE_ORIGIN}`)
  process.exit(1)
}

// ── 1. 解析 sitemap ─────────────────────────────────────────────────────────
if (!existsSync(SITEMAP_PATH)) {
  console.error(`\n❌ 找不到 ${SITEMAP_PATH}，先跑 pnpm generate:sitemap`)
  process.exit(1)
}
const xml = readFileSync(SITEMAP_PATH, 'utf-8')
const allUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
log(`\n📄 sitemap 共 ${allUrls.length} 条 URL`)

// 再过一遍域名门禁：哪怕 SITE_ORIGIN 是对的，sitemap 里万一有人写了别的也拦下
const safeUrls = allUrls.filter(u => {
  try {
    const h = new URL(u).hostname
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h.endsWith('.local')) return false
    // 只推 SITE_ORIGIN 同源的 URL，避免把别人域名报上去
    return h === host
  } catch { return false }
})
if (safeUrls.length !== allUrls.length) {
  log(`   ⚠️  已过滤 ${allUrls.length - safeUrls.length} 条非本域 / 本地域名 URL`)
}

// ── 2. 增量过滤 ─────────────────────────────────────────────────────────────
let snapshot = {}
if (existsSync(SNAPSHOT_PATH) && !flags.force) {
  try { snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8')) } catch {}
}
const cutoff = Date.now() - flags.resubmitDays * 86400_000
const toSubmit = flags.force
  ? safeUrls
  : safeUrls.filter(u => {
      const last = snapshot[u]
      return !last || Date.parse(last) < cutoff
    })

log(`   待推送        : ${toSubmit.length} 条`)
log(`   已跳过（最近 ${flags.resubmitDays} 天推过）: ${safeUrls.length - toSubmit.length} 条`)

if (toSubmit.length === 0) {
  log('\n✨ 没有需要新推的 URL，结束。')
  process.exit(0)
}

if (flags.dryRun) {
  log('\n--- dry-run 列表（不会真正请求） ---')
  toSubmit.forEach(u => log('  ' + u))
  process.exit(0)
}

// ── 3. 推送 ─────────────────────────────────────────────────────────────────
const submittedAt = new Date().toISOString()
const results = []

// 3.1 百度站长平台
if (BAIDU_TOKEN) {
  try {
    // 百度 site 参数只接受纯域名（不能带 https://），否则返回 site init fail
    const siteHost = new URL(SITE_ORIGIN).host // → tool.fologde.com
    const endpoint = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(siteHost)}&token=${encodeURIComponent(BAIDU_TOKEN)}`
    // 百度接口每批最多 2000 条；这里数据量小，一次发完。
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: toSubmit.join('\n'),
    })
    const text = await res.text()
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = { raw: text } }
    if (parsed.success !== undefined) {
      console.log(`\n   ✅ 百度：成功 ${parsed.success} 条 / 剩余配额 ${parsed.remain ?? '?'}`)
      results.push({ engine: 'baidu', ok: parsed.success, remain: parsed.remain })
    } else {
      console.warn('\n   ⚠️ 百度返回：' + text)
      results.push({ engine: 'baidu', ok: 0, error: text })
    }
  } catch (e) {
    console.error('\n   ❌ 百度推送异常：' + e.message)
    results.push({ engine: 'baidu', ok: 0, error: e.message })
  }
}

// 3.2 IndexNow（Bing / Yandex / Seznam / Naver 一并推送）
if (INDEXNOW_KEY && INDEXNOW_KEY_LOC) {
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: host,
        key: INDEXNOW_KEY,
        keyLocation: INDEXNOW_KEY_LOC,
        urlList: toSubmit,
      }),
    })
    // IndexNow: 200 成功 / 4xx 业务错误
    if (res.status === 200) {
      console.log(`   ✅ IndexNow (Bing/Yandex/Seznam/Naver)：已提交 ${toSubmit.length} 条`)
      results.push({ engine: 'indexnow', ok: toSubmit.length, status: 200 })
    } else {
      const body = await res.text()
      console.warn(`   ⚠️ IndexNow HTTP ${res.status}：${body}`)
      results.push({ engine: 'indexnow', ok: 0, status: res.status, error: body })
    }
  } catch (e) {
    console.error('   ❌ IndexNow 推送异常：' + e.message)
    results.push({ engine: 'indexnow', ok: 0, error: e.message })
  }
}

// 3.3 Google：ping sitemap 更新通知
if (GOOGLE_PING) {
  try {
    const sitemapUrl = `${SITE_ORIGIN.replace(/\/$/, '')}/sitemap.xml`
    const url = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
    const res = await fetch(url, { method: 'GET' })
    console.log(`   ✅ Google sitemap ping：HTTP ${res.status}`)
    results.push({ engine: 'google', status: res.status })
  } catch (e) {
    console.error('   ❌ Google ping 异常：' + e.message)
    results.push({ engine: 'google', error: e.message })
  }
}

// ── 4. 写回快照（任何一家成功都记） ─────────────────────────────────────────
const anySuccess = results.some(r => (r.ok ?? 0) > 0 || r.status === 200)
if (anySuccess) {
  for (const u of toSubmit) snapshot[u] = submittedAt
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8')
  console.log(`\n📝 已更新快照 ${SNAPSHOT_PATH}`)
}

// ── 5. 全部失败则非零退出，方便 CI 看见 ────────────────────────────────────
if (results.length > 0 && !results.some(r => (r.ok ?? 0) > 0 || r.status === 200)) {
  console.error('\n❌ 所有引擎都失败了，请检查 token / 网络')
  process.exit(1)
}
console.log('\n✨ 完成')
