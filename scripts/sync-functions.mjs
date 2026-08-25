#!/usr/bin/env node
// 把源码 functions/ 复制到 dist/functions/，让 wrangler pages dev 跑的是最新代码
// 生产部署会走 pnpm build:pro 自动覆盖 dist，但 dev 模式不 build，会一直跑旧的

import { cp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const src = path.join(root, 'functions')
const dst = path.join(root, 'dist', 'functions')

if (!existsSync(src)) {
  console.error('[sync-functions] 找不到 functions/ 目录，跳过')
  process.exit(0)
}

// 确保 dist 存在
if (!existsSync(path.dirname(dst))) {
  console.log('[sync-functions] dist/ 不存在，跳过（请先 pnpm build）')
  process.exit(0)
}

// 清理旧的 dist/functions 然后整体复制
await rm(dst, { recursive: true, force: true })
await cp(src, dst, { recursive: true })
console.log('[sync-functions] functions/ → dist/functions/ 已同步')