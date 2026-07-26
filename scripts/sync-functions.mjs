/**
 * 把 Cloudflare Functions 相关文件同步到 dist/，确保 `wrangler pages deploy ./dist`
 * 发布出去的产物里包含最新的 functions 代码和静态配置文件。
 *
 * 为什么需要这个脚本：Vite 只负责打包前端资源；Cloudflare Functions / wrangler.toml /
 * robots.txt / sitemap.xml 这些不在 Vite 输出范围内。CLAUDE.md / README 之前都靠人工
 * xcopy，容易漏文件（历史上 `dist/functions/api/me/credits/transactions.js` 就是这样漏的）。
 *
 * 同步清单：
 *   - functions/       → dist/functions/     （递归，覆盖；新增/删除都跟随）
 *   - wrangler.toml    → dist/wrangler.toml  （覆盖）
 *   - robots.txt       → dist/robots.txt     （覆盖；不存在则跳过）
 *   - sitemap.xml      → dist/sitemap.xml    （覆盖；不存在则跳过）
 *
 * 用法：`node scripts/sync-functions.mjs`
 *   也可单独通过 `pnpm sync:functions` 触发。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

/** 必需同步的目录（不存在就报错） */
const REQUIRED_DIRS = [
  { src: 'functions', dest: 'dist/functions' },
]

/** 单文件同步（不存在只警告，不报错） */
const OPTIONAL_FILES = [
  { src: 'wrangler.toml', dest: 'dist/wrangler.toml' },
  { src: 'robots.txt', dest: 'dist/robots.txt' },
  { src: 'sitemap.xml', dest: 'dist/sitemap.xml' },
]

/** Windows xcopy 等价：fs.cp({ recursive: true, force: true }) */
async function copyDir(srcAbs, destAbs) {
  await fs.cp(srcAbs, destAbs, { recursive: true, force: true })
}

async function copyFile(srcAbs, destAbs) {
  await fs.copyFile(srcAbs, destAbs)
}

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  // dist 必须已存在（Vite build 先于 sync-functions 跑）
  if (!(await exists(path.join(ROOT, 'dist')))) {
    console.error('[sync-functions] dist/ 不存在，请先跑 pnpm build:pro')
    process.exit(1)
  }

  let copied = 0
  let skipped = 0

  for (const { src, dest } of REQUIRED_DIRS) {
    const srcAbs = path.join(ROOT, src)
    const destAbs = path.join(ROOT, dest)
    if (!(await exists(srcAbs))) {
      console.error(`[sync-functions] 必需目录不存在：${src}`)
      process.exit(1)
    }
    await copyDir(srcAbs, destAbs)
    copied++
    console.log(`[sync-functions] ✓ ${src}/ → ${dest}/`)
  }

  for (const { src, dest } of OPTIONAL_FILES) {
    const srcAbs = path.join(ROOT, src)
    const destAbs = path.join(ROOT, dest)
    if (!(await exists(srcAbs))) {
      console.log(`[sync-functions] ⊘ 跳过（不存在）：${src}`)
      skipped++
      continue
    }
    await fs.mkdir(path.dirname(destAbs), { recursive: true })
    await copyFile(srcAbs, destAbs)
    copied++
    console.log(`[sync-functions] ✓ ${src} → ${dest}`)
  }

  console.log(`[sync-functions] 完成（${copied} 项同步，${skipped} 项跳过）`)
}

main().catch((err) => {
  console.error('[sync-functions] FAILED:', err)
  process.exit(1)
})