#!/usr/bin/env node
/**
 * deploy:cf 的末尾钩子。
 *
 * 设计目的：把"是否推送搜索引擎"的开关放在命令行上，而不是 .env 里。
 *   pnpm deploy:cf            → 不推送
 *   pnpm deploy:cf --push     → 推送（调用 submit-search.mjs）
 *   pnpm deploy:cf --push --force
 *                            → 推送 + 强制全量（透传给 submit-search）
 *
 * 如果哪天想恢复"deploy 默认就推"的旧行为，把这个脚本删了、直接在 package.json
 * 把 deploy:cf 末尾改成 && pnpm submit:search 即可。
 */
import { spawnSync } from 'node:child_process'

const argv = process.argv.slice(2)
const wantPush = argv.includes('--push')

if (!wantPush) {
  console.log('⏭️  未传 --push，跳过搜索引擎推送（仅部署）')
  process.exit(0)
}

// 透传所有 flag 给 submit-search
const passthrough = ['--push', '--force', '--dry-run']
  .filter(f => argv.includes(f))
  .concat(
    argv.filter(a => a.startsWith('--resubmit-days='))
  )

const res = spawnSync(process.execPath, ['scripts/submit-search.mjs', ...passthrough], {
  stdio: 'inherit',
})
process.exit(res.status ?? 0)