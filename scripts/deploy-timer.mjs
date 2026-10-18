#!/usr/bin/env node
/**
 * deploy:cf 的计时器（跨平台，替代 set X=1 && ... 的 shell 写法）。
 *
 *   node scripts/deploy-timer.mjs start   # 链路开头：记录起始时间戳
 *   node scripts/deploy-timer.mjs end     # 链路末尾：打印总耗时与完成时间
 *
 * 时间戳存在 node_modules/.cache/ 下，链路任何一步失败中断时不会误报完成。
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const mode = process.argv[2]
const stampFile = path.join(process.cwd(), 'node_modules', '.cache', 'deploy-start')

function fmtDuration(ms) {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

if (mode === 'start') {
  mkdirSync(path.dirname(stampFile), { recursive: true })
  writeFileSync(stampFile, String(Date.now()))
  process.exit(0)
}

if (mode === 'end') {
  let started = 0
  try {
    started = Number(readFileSync(stampFile, 'utf8'))
  } catch {
    console.log('[deploy] 未找到起始时间戳，跳过耗时统计')
    process.exit(0)
  }
  rmSync(stampFile, { force: true })
  const finishAt = new Date()
  console.log('────────────────────────────────────────')
  console.log(`[deploy] ✅ 部署完成  ${finishAt.toLocaleString('zh-CN', { hour12: false })}`)
  console.log(`[deploy] 总耗时 ${fmtDuration(Date.now() - started)}`)
  process.exit(0)
}

console.error('用法：node scripts/deploy-timer.mjs start|end')
process.exit(1)
