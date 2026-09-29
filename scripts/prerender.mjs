#!/usr/bin/env node
/**
 * 生产构建后的 SEO 预渲染（并发版）：
 *   pnpm build:pro → vite build → node scripts/prerender.mjs → sync:functions
 *
 * 用一个 Chrome 实例开 N 个标签页并行渲染 dist 里的每个路由，产出
 * dist/<route>/index.html —— 爬虫（含不执行 JS 的百度）直接拿到带完整
 * 标题/描述/正文的静态 HTML。
 *
 * 为什么是全量渲染、不能只渲染改动的页面：
 *   每个预渲染 HTML 都内嵌本次构建的带 hash 资源（/js/index-xxx.js），
 *   而入口 chunk 每次构建 hash 必变（vite.config 注入了 __BUILD_TIME__，
 *   线上版本守卫依赖它），所以任何一次部署后所有页面的 HTML 都必须重写。
 *   提速手段是并发，而不是增量。
 *
 * 环境变量：
 *   PRERENDER=0            跳过预渲染（页面 meta 仍由线上中间件兜底）
 *   PRERENDER_CONCURRENCY  并发标签页数，默认 6
 *   PRERENDER_DELAY        每页渲染后等待毫秒数（等 SPA 挂载），默认 800
 *
 * 单页失败只记警告不影响整体（该页退回 SPA 壳 + 中间件 meta 兜底）；
 * 浏览器起不来同样跳过且不阻塞构建。
 */

import { exec } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import puppeteer from 'puppeteer'
// 与 functions/_middleware.js 同源的路由 meta 表（构建前由 generate-page-meta.mjs 生成）
import pageMeta from '../functions/_page-meta.js'

const root = process.cwd()
const distDir = path.join(root, 'dist')

if (process.env.PRERENDER === '0') {
  console.log('[prerender] PRERENDER=0，跳过预渲染（线上中间件会按路径改写页面 meta）')
  process.exit(0)
}

const routes = Object.keys(pageMeta)
if (routes.length === 0) {
  console.log('[prerender] 路由表为空，跳过')
  process.exit(0)
}

const CONCURRENCY = Math.max(1, Math.min(12, Number(process.env.PRERENDER_CONCURRENCY) || 6))
// 渲染就绪后的额外稳定窗口；主门控是下方 waitForFunction 的 DOM 就绪判断
const SETTLE_MS = Math.max(0, Number(process.env.PRERENDER_DELAY) ?? 300)

// ---- meta 注入（与 functions/_middleware.js 的改写逻辑保持一致）----

function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 普通 meta 用 name="..."，Open Graph 系用 property="..."
function replaceMetaContent(html, name, value) {
  return html.replace(new RegExp(`<meta\\b[^>]*\\b(?:name|property)=["']${name}["'][^>]*>`, 'i'), (tag) =>
    tag.replace(/\bcontent=["'][^"']*["']/i, `content="${escapeHtmlAttr(value)}"`)
  )
}

function injectPageMeta(html, route) {
  const norm = route !== '/' && route.endsWith('/') ? route.slice(0, -1) : route
  const meta = pageMeta[norm]
  if (!meta) return html
  let out = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(meta.title)}</title>`)
  out = replaceMetaContent(out, 'description', meta.description)
  out = replaceMetaContent(out, 'keywords', meta.keywords)
  out = replaceMetaContent(out, 'og:title', meta.title)
  out = replaceMetaContent(out, 'og:description', meta.description)
  out = replaceMetaContent(out, 'og:url', meta.ogUrl)
  out = replaceMetaContent(out, 'twitter:title', meta.title)
  out = replaceMetaContent(out, 'twitter:description', meta.description)
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- 起 vite preview（随机空闲端口），从 stdout 抓 Local 地址 ----

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = exec('pnpm exec vite preview --port 0', { cwd: root }, (err) => {
      if (err) console.error('[prerender] preview 进程退出:', err.code ?? err.message)
    })
    let local = ''
    const timer = setTimeout(() => {
      if (!local) {
        child.kill()
        reject(new Error('vite preview 30s 内未输出地址'))
      }
    }, 30_000)
    child.stdout.on('data', (chunk) => {
      if (local) return
      const m = String(chunk).match(/http:\/\/(.*?)\//g)
      if (m && m.length) {
        local = m[0].replace(/\x1B\[\d+m/g, '').slice(0, -1)
        clearTimeout(timer)
        console.log('[prerender] preview:', local)
        resolve({ child, local })
      }
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
  })
}

// ---- 并发渲染 ----

async function renderRoute(page, local, route) {
  // 带尾斜杠确保命中 dist/<route>/index.html；文件尚不存在时 preview 走 SPA
  // fallback 返回壳 HTML，SPA 挂载后同样渲染出目标页，二者等价
  await page.goto(`${local}${route}/`, { waitUntil: 'load', timeout: 30_000 })
  await page.waitForSelector('body', { timeout: 15_000 })
  // 等 SPA 真正渲染出内容再快照：并发标签页会争抢 CPU，固定延时不可靠
  // （上一版固定 800ms 在 6 并发下工具组件没挂载完，快照只剩布局壳）。
  // 就绪标准：#app 挂载出足够节点且有可见文本（布局侧栏 + 工具界面远超此值）
  try {
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#app')
        return !!el && el.querySelectorAll('*').length > 50 && (el.innerText || '').trim().length > 100
      },
      { timeout: 15_000, polling: 200 }
    )
  } catch {
    console.warn(`[prerender] ${route}: 等待渲染超时，按当前 DOM 快照落盘`)
  }
  await sleep(SETTLE_MS)
  let html = await page.content()
  // 把序列化时补全的本地 origin 去掉，资源路径恢复为根相对（/js/...）
  html = html.split(local).join('')
  html = injectPageMeta(html, route)
  const file = path.join(distDir, route, 'index.html')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, html)
}

async function main() {
  const started = Date.now()
  let preview
  try {
    preview = await startPreview()
  } catch (e) {
    console.error(`[prerender] ⚠️ vite preview 启动失败，跳过预渲染（${e.message}）。页面 meta 由线上中间件兜底。`)
    process.exit(0)
  }
  const { child, local } = preview

  let browser
  try {
    browser = await puppeteer.launch()
  } catch (e) {
    console.error(`[prerender] ⚠️ Chrome 启动失败，跳过预渲染（${e.message}）。可检查 puppeteer 浏览器缓存，或 PRERENDER=0 显式跳过。`)
    child.kill()
    process.exit(0)
  }

  const pages = []
  for (let i = 0; i < CONCURRENCY; i++) pages.push(await browser.newPage())

  let next = 0
  const okRoutes = []
  const failedRoutes = []

  async function worker(page) {
    while (true) {
      const i = next++
      if (i >= routes.length) return
      const route = routes[i]
      try {
        await renderRoute(page, local, route)
        okRoutes.push(route)
      } catch (e) {
        // 换一个全新标签页重试一次（原页面可能已被上一轮导航污染）
        try {
          await page.close()
        } catch { /* 忽略 */ }
        try {
          const fresh = await browser.newPage()
          pages[pages.indexOf(page)] = fresh
          page = fresh
          await renderRoute(page, local, route)
          okRoutes.push(route)
          console.log(`[prerender] ${route} ✓（重试成功：${e.message}）`)
          continue
        } catch (e2) {
          failedRoutes.push(route)
          console.error(`[prerender] ✗ ${route}: ${e2.message}`)
        }
      }
    }
  }

  await Promise.all(pages.map((p) => worker(p)))

  await browser.close()
  child.kill()

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`[prerender] 完成：${okRoutes.length}/${routes.length} 页，耗时 ${secs}s，并发 ${CONCURRENCY}`)
  if (failedRoutes.length) {
    console.error(`[prerender] ⚠️ ${failedRoutes.length} 页渲染失败（已退回 SPA 壳 + 中间件 meta 兜底）: ${failedRoutes.join(', ')}`)
  }
  process.exit(0)
}

main()
