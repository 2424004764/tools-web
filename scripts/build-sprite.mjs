/**
 * 构建脚本：把 public/images/logo/ 下所有工具 logo 合并成单张透明 PNG 精灵图
 * 用法：node scripts/build-sprite.mjs
 * 产物：
 *   - public/sprites/tools.png           (透明 PNG)
 *   - src/components/Tools/sprite-coords.json  (tool.id → { x, y, w, h })
 */

import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// === 精灵图参数 ===
const CELL = 80        // 每个 logo 实际像素（Retina @2x 下显示 40×40）
const PAD = 4          // 格子间透明 padding（避免边缘抗锯齿渗色）
const STRIDE = CELL + PAD  // 84
const COLS = 8         // 列数
const SVG_DENSITY = 300 // SVG 栅格化 DPI，越大越清晰但越慢

const PNG_OUT = path.join(ROOT, 'public/sprites/tools.png')
const COORDS_OUT = path.join(ROOT, 'src/components/Tools/sprite-coords.json')
const TOOLS_TS = path.join(ROOT, 'src/components/Tools/tools.ts')

async function parseTools() {
  const src = await fs.readFile(TOOLS_TS, 'utf8')
  const re = /id:\s*(\d+)\s*,[\s\S]{0,200}?logo:\s*['"]([^'"]+)['"]/g
  const entries = []
  let m
  while ((m = re.exec(src)) !== null) {
    const id = Number(m[1])
    const logo = m[2]
    if (logo.startsWith('/images/logo/')) entries.push({ id, logo })
  }
  return entries
}

async function loadCell(logoUrl) {
  const filePath = path.join(ROOT, 'public' + logoUrl)
  const ext = path.extname(filePath).toLowerCase()
  const pipeline = ext === '.svg'
    ? sharp(filePath, { density: SVG_DENSITY, failOn: 'none' })
    : sharp(filePath, { failOn: 'none' })
  return await pipeline
    .resize(CELL, CELL, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
}

async function main() {
  console.log('[sprite] 解析 tools.ts …')
  const entries = await parseTools()
  console.log(`[sprite] 解析到 ${entries.length} 个工具条目`)

  // 按 logo URL 去重（保留首次出现顺序），并构建 id → cell 映射
  const logoOrder = []                        // cell index → logo URL
  const logoToCell = new Map()                // logo URL → cell index
  const idToCell = new Map()                  // tool id → cell index
  for (const e of entries) {
    if (!logoToCell.has(e.logo)) {
      logoToCell.set(e.logo, logoOrder.length)
      logoOrder.push(e.logo)
    }
    idToCell.set(e.id, logoToCell.get(e.logo))
  }
  console.log(`[sprite] 唯一 logo: ${logoOrder.length}`)

  // 并行处理每个唯一 logo → 80×80 RGBA buffer
  console.log('[sprite] 处理 logo（并行）…')
  const results = await Promise.allSettled(logoOrder.map(loadCell))
  const cells = []
  let failed = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      cells.push(r.value)
    } else {
      failed++
      console.warn(`[sprite]   ✗ ${logoOrder[i]}: ${r.reason?.message || r.reason}`)
      cells.push(null)
    }
  })
  console.log(`[sprite] 成功 ${cells.length - failed}，失败 ${failed}`)

  // 过滤失败的 logo —— 重算 cell index（只保留成功的）
  const remap = new Map()  // old cell index → new cell index
  const successfulLogos = []
  cells.forEach((c, i) => {
    if (c) {
      remap.set(i, successfulLogos.length)
      successfulLogos.push(logoOrder[i])
    }
  })

  // 拼图
  const total = successfulLogos.length
  const rows = Math.max(1, Math.ceil(total / COLS))
  const W = COLS * STRIDE
  const H = rows * STRIDE
  console.log(`[sprite] 画布: ${W}×${H}（${rows} 行）`)

  const composites = successfulLogos.map((_, newIdx) => {
    const oldIdx = cells.findIndex((c, i) => c && logoOrder[i] === successfulLogos[newIdx])
    const cell = cells[oldIdx]
    const col = newIdx % COLS
    const row = Math.floor(newIdx / COLS)
    return {
      input: cell.data,
      raw: { width: cell.info.width, height: cell.info.height, channels: cell.info.channels },
      left: col * STRIDE,
      top: row * STRIDE,
    }
  })

  await fs.mkdir(path.dirname(PNG_OUT), { recursive: true })
  await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(PNG_OUT)

  // 写坐标 JSON —— key 用 logo URL（唯一），不依赖 tools.ts 里质量堪忧的 id
  const coords = {}
  for (const logo of successfulLogos) {
    const newIdx = successfulLogos.indexOf(logo)
    const col = newIdx % COLS
    const row = Math.floor(newIdx / COLS)
    coords[logo] = {
      x: col * STRIDE,
      y: row * STRIDE,
      w: CELL,
      h: CELL,
    }
  }

  await fs.mkdir(path.dirname(COORDS_OUT), { recursive: true })
  await fs.writeFile(COORDS_OUT, JSON.stringify(coords, null, 2) + '\n')

  const stat = await fs.stat(PNG_OUT)
  console.log(`[sprite] ✓ ${PNG_OUT} (${(stat.size / 1024).toFixed(1)} KB, ${W}×${H})`)
  console.log(`[sprite] ✓ ${COORDS_OUT} (${Object.keys(coords).length} 个 logo)`)

  if (failed / logoOrder.length > 0.05) {
    console.error(`[sprite] 失败率 ${(failed / logoOrder.length * 100).toFixed(1)}% 超过 5% 阈值`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[sprite] FAILED:', err)
  process.exit(1)
})