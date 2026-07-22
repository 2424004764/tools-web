// scripts/seed-tool-features.mjs
// 解析 src/components/Tools/tools.ts 中的 getToolsCate()，
// 生成 functions/db/030_seed_tool_features.sql 初始化 SQL。
//
// 使用方法：node scripts/seed-tool-features.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const toolsTsPath = path.join(projectRoot, 'src/components/Tools/tools.ts')
const outPath = path.join(projectRoot, 'functions/db/030_seed_tool_features.sql')

const content = readFileSync(toolsTsPath, 'utf-8')

// 简单手写解析 getToolsCate() 返回值
// 期望结构：[{ id, title, list: [{ id, title, logo, desc, url, cateId, cate }, ...] }, ...]
const tools = []

// 用正则匹配每个分类对象的大块内容
// 从 "      id: N,\n      title: '...'," 开头，到 "      ]\n    }" 结束
// 嵌套 list 也是类似结构，但缩进更深

const cateBlockRe = /{\s*id:\s*(\d+),\s*title:\s*'([^']+)',[\s\S]*?list:\s*\[([\s\S]*?)\]\s*,?\s*}/g
const toolRe = /\{\s*id:\s*(\d+),\s*title:\s*'((?:[^'\\]|\\.)*)',[\s\S]*?logo:\s*'((?:[^'\\]|\\.)*)',[\s\S]*?desc:\s*'((?:[^'\\]|\\.)*)',[\s\S]*?url:\s*'((?:[^'\\]|\\.)*)',\s*cateId:\s*(\d+),\s*cate:\s*'((?:[^'\\]|\\.)*)'/g

let cateMatch
while ((cateMatch = cateBlockRe.exec(content)) !== null) {
  const cateId = parseInt(cateMatch[1], 10)
  const cateTitle = cateMatch[2]
  const listBody = cateMatch[3]

  let toolMatch
  // 重置正则到当前 listBody 内部重新匹配
  const listOnly = listBody
  const re = new RegExp(toolRe.source, 'g')
  while ((toolMatch = re.exec(listOnly)) !== null) {
    const tool = {
      id: parseInt(toolMatch[1], 10),
      title: toolMatch[2],
      logo: toolMatch[3],
      desc: toolMatch[4],
      url: toolMatch[5],
      cateId: parseInt(toolMatch[6], 10),
      cate: toolMatch[7],
    }
    tools.push(tool)
  }
}

if (tools.length === 0) {
  console.error('❌ 未从 tools.ts 解析到任何工具，请检查正则或源文件结构')
  process.exit(1)
}

// 去重：先按 url 去重，再按 id 去重（保留首次出现）
// 注意：tools.ts 源数据中部分 id 被跨分类复用（如 id 27 既用于「阿里云 OSS 管理」
// 又用于「文本对比」），导致 PRIMARY KEY(id) UNIQUE 冲突。
// 去重策略：id 优先于 url，因为 url 才是用户实际使用的路由，id 只是历史遗留。
const byUrl = new Map()
for (const t of tools) {
  if (!byUrl.has(t.url)) byUrl.set(t.url, t)
}
const byId = new Map()
for (const t of byUrl.values()) {
  if (!byId.has(t.id)) byId.set(t.id, t)
}
const unique = Array.from(byId.values())

// 报告被去重的条目
const removed = tools.length - unique.length
if (removed > 0) {
  console.warn(`⚠️  去重移除 ${removed} 条（重复 url 或 id）`)
}

// 生成 SQL
const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
const escapeSql = (s) => s.replace(/'/g, "''")

let sql = `-- 工具功能开关初始数据\n`
sql += `-- 自动生成自 src/components/Tools/tools.ts（共 ${unique.length} 个工具）\n`
sql += `-- 生成时间：${new Date().toISOString()}\n`
sql += `-- 注意：tool_features 表结构见 028_create_tool_features.sql\n\n`

// 用 INSERT 批量插入，每条都包含完整字段
const rows = unique.map((t, idx) => {
  return `('${escapeSql(String(t.id))}', '${escapeSql(t.title)}', '${escapeSql(t.url)}', ${t.cateId}, '${escapeSql(t.cate)}', '${escapeSql(t.desc)}', '${escapeSql(t.logo)}', ${idx}, 1, '${now}', '${now}')`
})

// SQLite 单条 INSERT VALUES 数量有限制（默认 999），分批写
const batchSize = 100
for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize)
  sql += `INSERT INTO tool_features (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at) VALUES\n`
  sql += batch.join(',\n') + ';\n\n'
}

writeFileSync(outPath, sql, 'utf-8')
console.log(`✅ 已生成 ${outPath}`)
console.log(`   共 ${unique.length} 个工具，按 url 去重后插入 tool_features 表`)