// 临时诊断脚本：对比 DB logo、tools.ts 引用、精灵图坐标、磁盘文件 四者的一致性
// 用法：先 wrangler d1 execute ... --json > db-logos.json，再 node scripts/diag-sprite.mjs
import fs from 'node:fs'

const dbRaw = fs.readFileSync('db-logos.json', 'utf8')
const dbRows = JSON.parse(dbRaw.slice(dbRaw.indexOf('[')))?.[0]?.results || []

const src = fs.readFileSync('src/components/Tools/tools.ts', 'utf8')
const tsLogos = new Set()
for (const m of src.matchAll(/logo:\s*'([^']*)'/g)) {
  if (m[1].startsWith('/images/logo/')) tsLogos.add(m[1])
}

const coords = JSON.parse(fs.readFileSync('src/components/Tools/sprite-coords.json', 'utf8'))
const inSprite = new Set(Object.keys(coords))

console.log('--- DB logo 不在精灵图中的工具：')
for (const row of dbRows) {
  const l = row.logo || ''
  if (l.startsWith('/images/logo/') && !inSprite.has(l)) {
    const onDisk = fs.existsSync('public' + l)
    console.log(`${row.url}  ${l}  ${onDisk ? '(文件存在→应进精灵图)' : '(文件缺失→404)'}`)
  }
}

console.log('--- DB logo 为空的工具：')
for (const row of dbRows) {
  if (!row.logo) console.log(row.url)
}

console.log('--- tools.ts 引用但磁盘缺失：')
for (const l of tsLogos) {
  if (!fs.existsSync('public' + l)) console.log(l)
}
