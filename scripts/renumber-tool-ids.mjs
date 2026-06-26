/**
 * 把 src/components/Tools/tools.ts 中所有"工具项"的 id 重排成递增序列（1, 2, 3, ...）。
 * 只动 list: [...] 数组里的 id；不动外层分类的 id；跳过注释行。
 *
 * 一次性脚本：跑一次就够。后续 sprite:build 不再自动调用它。
 *
 * 用法：node scripts/renumber-tool-ids.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const TOOLS_TS = path.join(ROOT, 'src/components/Tools/tools.ts')

/**
 * 扫描 src，找到所有"工具层"的 id: N,。
 * 判定规则：
 *   1) 行首正好 10 个空格（与 `          id: N,` 匹配），不是 `          // ...`
 *   2) 当前位置处于某个 `list: [` 之内（用 listDepth 跟踪）
 * 返回按源码顺序排列的 { start, end, oldId }。
 */
function findToolIds(src) {
  const lines = src.split('\n')
  const positions = []
  let listDepth = 0
  let byteOffset = 0

  for (const line of lines) {
    // 跟踪 list 嵌套
    if (/^\s*list:\s*\[/.test(line)) listDepth++
    // 关闭 list：行内首部是 ], 可带逗号
    if (/^\s*\],?\s*$/.test(line) && listDepth > 0) listDepth--

    // 工具层 id：行首恰好 10 个空格 + id: N,
    // 注释行的开头是 `        //   id:`（8 空格 + // + 空格），不会被这条正则匹配
    const m = /^ {10}id:\s*(\d+)\s*,/.exec(line)
    if (m && listDepth > 0) {
      const start = byteOffset + 10  // 行首偏移 10 字符 = id 起始
      const end = start + m[0].length - 10  // 不含前导 10 空格
      positions.push({ start, end, oldId: Number(m[1]) })
    }

    byteOffset += line.length + 1  // +1 for '\n'
  }
  return positions
}

async function main() {
  const src = await fs.readFile(TOOLS_TS, 'utf8')
  const positions = findToolIds(src)

  if (positions.length === 0) {
    console.log('[renumber] 没找到工具层 id，退出')
    return
  }

  // 检查是否已经递增
  const isAlreadySequential = positions.every((p, i) => p.oldId === i + 1)
  if (isAlreadySequential) {
    console.log(`[renumber] id 已经是 1..${positions.length} 递增，无需修改`)
    return
  }

  // 备份
  const backup = TOOLS_TS + '.bak'
  await fs.writeFile(backup, src)
  console.log(`[renumber] 备份到 ${backup}`)

  // 倒序替换（不影响索引）
  let out = src
  for (let i = positions.length - 1; i >= 0; i--) {
    const p = positions[i]
    const newId = i + 1
    out = out.slice(0, p.start) + `id: ${newId},` + out.slice(p.end)
  }

  await fs.writeFile(TOOLS_TS, out)
  const uniqueOldIds = new Set(positions.map(p => p.oldId)).size
  console.log(`[renumber] ✓ 重排 ${positions.length} 个工具 id（${uniqueOldIds} 个旧值 → 1..${positions.length}）`)
  console.log(`[renumber] 备份保留在 ${backup}，确认无误后可手动删除`)
}

main().catch((err) => {
  console.error('[renumber] FAILED:', err)
  process.exit(1)
})