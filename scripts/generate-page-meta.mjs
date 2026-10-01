#!/usr/bin/env node
/**
 * 从 src/router/router.ts 提取每条路由的 SEO meta，生成两份产物：
 *
 *  1. functions/_page-meta.js   —— CF Pages 中间件（_middleware.js）按路径改写
 *     初始 HTML 的 title / description / keywords / og:* / twitter:* 用。
 *     下划线前缀 = Pages Functions 不把它当路由，仅供 import。
 *
 *  2. --update-routes 时，把每个页面路径（/x 与 /x/* 两条规则）合并进
 *     functions/_routes.json 的 include，让中间件能收到页面请求。
 *
 * vite.config.ts 也会 import functions/_page-meta.js 拿预渲染路由表
 * （vite-plugin-seo-prerender 的 routes 参数），并在 callback 里用同一份
 * meta 做构建时注入 —— 两端永远同源，不会出现两处文案不一致。
 *
 * 运行时机：
 *  - pnpm prebuild:pro（构建前，保证 vite build 读到最新路由表）
 *  - 手动 node scripts/generate-page-meta.mjs [--update-routes]
 *
 * 注意：产物是提交进仓库的（dev:wrangler 依赖它存在），改动 router.ts 的
 * meta 后重跑本脚本即可刷新。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
// SEO 优化标题（用户会搜的词前置），与 src/router/index.ts 共用同一份，
// 保证爬虫看到的初始 HTML 标题和用户标签页标题一致
import seoTitles from '../src/router/seo-titles.js'

const root = process.cwd()
const routerPath = path.join(root, 'src', 'router', 'router.ts')
const outFile = path.join(root, 'functions', '_page-meta.js')
const routesFile = path.join(root, 'functions', '_routes.json')

// ---- env 读取（vite loadEnv 的极简版：.env → .env.production 后者覆盖）----
function loadEnvFile(file, into) {
  let raw = ''
  try {
    raw = readFileSync(file, 'utf-8')
  } catch {
    return
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*['"]?([^'"\r\n]*)['"]?\s*$/)
    if (m) into[m[1]] = m[2].trim()
  }
}

const env = {}
loadEnvFile(path.join(root, '.env'), env)
loadEnvFile(path.join(root, '.env.production'), env)
const APP_TITLE = env.VITE_APP_TITLE || '开发者工具箱'
const APP_DESC = env.VITE_APP_DESC || ''
const SITE_ORIGIN = (env.VITE_SITE_URL || env.SITE_ORIGIN || 'https://tool.fologde.com').replace(/\/$/, '')

// 与 src/router/index.ts afterEach 的 document.title 逻辑保持一致：
// 优先取 seo-titles.js 的优化标题，否则用路由 meta.title，统一 " | 站名" 结尾
const composeTitle = (norm, title) => {
  const base = seoTitles[norm] || title
  return base ? `${base} | ${APP_TITLE}` : APP_DESC ? `${APP_TITLE}-${APP_DESC}` : APP_TITLE
}

// ---- 解析 router.ts ----
// 不引 TS 文件，按「path: 到下一个 path: 之间是一个路由块」切段后逐块抓 meta 字段。
const source = readFileSync(routerPath, 'utf-8')

// 不需要暴露给爬虫的页面：登录/后台/个人中心/博客编辑器等
const SKIP_PATHS = [/^\/$/, /^\/login/, /^\/userinfo/, /^\/admin/, /^\/404/, /^\/search/, /^\/blog\/write$/]

const pathRe = /\bpath:\s*(['"])([^'"]*)\1/g
const entries = []
const rawTitleByPath = new Map() // 原始 meta.title，用于自动生成 SEO 标题草稿
const keywordsByPath = new Map() // 原始 meta.keywords，同上
let m
const matches = []
while ((m = pathRe.exec(source))) matches.push({ path: m[2], index: m.index })

for (let i = 0; i < matches.length; i++) {
  const routePath = matches[i].path
  const block = source.slice(matches[i].index, i + 1 < matches.length ? matches[i + 1].index : undefined)
  const pick = (name) => {
    const mm = block.match(new RegExp(`\\b${name}:\\s*(['"` + String.fromCharCode(34) + '])([\\s\\S]*?)\\1'))
    return mm ? mm[2].trim() : ''
  }
  const title = pick('title')
  const keywords = pick('keywords')
  const description = pick('description')

  // 动态路由（:id 等）无法预生成静态 HTML，跳过
  if (routePath.includes(':')) continue
  // admin 等嵌套路由的相对 path（'dashboard'）不是 URL 路径，跳过
  if (!routePath.startsWith('/')) continue
  if (SKIP_PATHS.some((re) => re.test(routePath))) continue

  const norm = routePath !== '/' && routePath.endsWith('/') ? routePath.slice(0, -1) : routePath
  // 既没有 meta.title 也没有 SEO 标题的路由合成标题与全局壳一致，改写无意义，跳过
  if (!title && !seoTitles[norm]) continue

  rawTitleByPath.set(norm, title)
  keywordsByPath.set(norm, keywords)
  entries.push({
    path: norm,
    title: composeTitle(norm, title),
    keywords,
    description,
    ogUrl: `${SITE_ORIGIN}${norm}/`,
  })
}

if (entries.length === 0) {
  console.error('[gen:page-meta] 未从 router.ts 解析到任何路由，请检查解析逻辑')
  process.exit(1)
}

// ---- 自动补齐 SEO 标题 ----
// 新工具没配 SEO 标题时，自动生成草稿并追加进 src/router/seo-titles.js，
// 让这份文件始终与路由表同步；草稿 = meta.title + 不重复的关键词（≤2 个），
// 控制台列出清单，作者可随时润色（润色后不会再被覆盖，生成器只增不改）。

function draftSeoTitle(norm) {
  const title = rawTitleByPath.get(norm) || norm
  const kws = (keywordsByPath.get(norm) || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean)
  const lowerTitle = title.toLowerCase()
  const extra = kws.filter(k => k.length >= 2 && !lowerTitle.includes(k.toLowerCase())).slice(0, 2)
  if (!extra.length) return title
  // meta.title 自带 " - " 时换逗号衔接，避免标题里出现双破折号
  return title.includes(' - ') ? `${title}，${extra.join('/')}` : `${title} - ${extra.join('/')}`
}

// 粗查 seo-titles.js 是否已是最新（避免每次构建都重写文件产生 git 噪声）
const missingSeo = entries.filter((e) => !seoTitles[e.path])
if (missingSeo.length) {
  const seoFile = path.join(root, 'src', 'router', 'seo-titles.js')
  let text = readFileSync(seoFile, 'utf8')
  const insertAt = text.trimEnd().lastIndexOf('}')
  if (insertAt < 0) {
    console.error('[gen:page-meta] ⚠️ seo-titles.js 结构异常，无法自动追加，请检查该文件')
  } else {
    const newLines = missingSeo.map((e) => `  '${e.path}': '${draftSeoTitle(e.path).replace(/'/g, "\\'")}',`)
    const head = text.slice(0, insertAt).trimEnd()
    const needsComma = !head.endsWith(',')
    text = head + (needsComma ? ',' : '') + '\n' + newLines.join('\n') + '\n' + text.slice(insertAt)
    writeFileSync(seoFile, text, 'utf-8')
    // 同步到本次运行的内存映射，让 _page-meta.js 立即用上新标题
    for (const e of missingSeo) seoTitles[e.path] = draftSeoTitle(e.path)
    console.warn(`[gen:page-meta] 已自动为 ${missingSeo.length} 条新路由生成 SEO 标题草稿（追加至 src/router/seo-titles.js，可润色）：`)
    for (const e of missingSeo) {
      console.warn(`  '${e.path}': '${seoTitles[e.path]}',`)
    }
    // 重新计算使用新标题后的产物
    for (const e of missingSeo) e.title = composeTitle(e.path, rawTitleByPath.get(e.path))
  }
}

// 路由已删除但 SEO 标题还留着：提示清理（不自动删，避免临时改名丢文案）
const staleSeo = Object.keys(seoTitles).filter((k) => !entries.some((e) => e.path === k))
if (staleSeo.length) {
  console.warn(`[gen:page-meta] ⚠️ ${staleSeo.length} 条 SEO 标题没有对应路由（路由可能已删除/改名），确认后可从 src/router/seo-titles.js 删除：`)
  for (const k of staleSeo) console.warn(`  '${k}'`)
}

// ---- 生成 functions/_page-meta.js ----
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const mapLines = entries
  .map((e) =>
    `  '${esc(e.path)}': { title: '${esc(e.title)}', keywords: '${esc(e.keywords)}', description: '${esc(e.description)}', ogUrl: '${esc(e.ogUrl)}' },`
  )
  .join('\n')

const out = `/**
 * AUTO-GENERATED by scripts/generate-page-meta.mjs —— 请勿手改
 * 数据源：src/router/router.ts 的路由 meta（文案改 router.ts 后重跑生成器）
 * 用途：_middleware.js 按路径改写初始 HTML 的 SEO meta；vite.config.ts 预渲染路由表
 */

export const siteOrigin = '${esc(SITE_ORIGIN)}'

// 站点标题（中间件给博客详情页动态拼 title 用：\`\${post.title} | \${appTitle}\`）
export const appTitle = '${esc(APP_TITLE)}'

export default {
${mapLines}
}
`
writeFileSync(outFile, out, 'utf-8')
console.log(`[gen:page-meta] ${entries.length} 条路由 → functions/_page-meta.js`)

// ---- --update-routes：把页面路径合并进 _routes.json ----
if (process.argv.includes('--update-routes')) {
  const pageRules = entries.flatMap((e) => [e.path, `${e.path}/*`])
  let routes
  try {
    routes = JSON.parse(readFileSync(routesFile, 'utf-8'))
  } catch (e) {
    console.error(`[gen:page-meta] 解析 ${routesFile} 失败：${e.message}`)
    process.exit(1)
  }
  const ruleSet = new Set(routes.include)
  let added = 0
  for (const rule of pageRules) {
    if (!ruleSet.has(rule)) {
      routes.include.push(rule)
      added++
    }
  }
  writeFileSync(routesFile, JSON.stringify(routes, null, 2) + '\n', 'utf-8')
  console.log(`[gen:page-meta] _routes.json 新增 ${added} 条页面规则（现共 ${routes.include.length} 条 include）`)
}
