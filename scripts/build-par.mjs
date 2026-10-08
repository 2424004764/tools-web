#!/usr/bin/env node
/**
 * 类型检查与 vite build 并行执行（原 build 脚本是串行的 `vue-tsc && vite build`）。
 *
 *   node scripts/build-par.mjs [development|production]   # 默认 production
 *
 * - 两条命令互不依赖：vue-tsc 只读源码做类型检查，vite build 负责产物，
 *   并行后整条 build 链耗时 ≈ max(两者) 而不是 sum(两者)。
 * - 直接用 node 拉起两个包的 bin 入口（不走 shell / pnpm exec），Windows/Linux 通吃。
 * - 任意一方退出码非 0 即整体非 0 退出，&& 链上的后续步骤（prerender/deploy）不会执行。
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const mode = process.argv[2] === 'development' ? 'development' : 'production'

const tscBin = path.join(root, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js')
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

function run(label, args) {
  const started = Date.now()
  const child = spawn(process.execPath, args, { stdio: 'inherit', cwd: root })
  return new Promise((resolve) => {
    child.on('close', (code) => {
      console.log(`[build-par] ${label} 退出码 ${code}，耗时 ${((Date.now() - started) / 1000).toFixed(1)}s`)
      resolve(code ?? 1)
    })
    child.on('error', (e) => {
      console.error(`[build-par] ${label} 启动失败: ${e.message}`)
      resolve(1)
    })
  })
}

console.log(`[build-par] 并行执行 vue-tsc --noEmit 与 vite build --mode ${mode}`)
const [tscCode, viteCode] = await Promise.all([
  run('vue-tsc', [tscBin, '--noEmit']),
  run('vite build', [viteBin, 'build', '--mode', mode]),
])

process.exit(tscCode !== 0 ? tscCode : viteCode)
