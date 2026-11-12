// 验证 migrations/111_tool_models_upstreams.sql 的语法、回填与幂等性（node:sqlite 模拟 D1）
// 用法：node scripts/verify-migration-111.mjs（一次性脚本，可删）
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

const db = new DatabaseSync(':memory:')

// 最小 schema（与生产 D1 一致的关键约束）
db.exec(`
  CREATE TABLE ai_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT DEFAULT '',
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT DEFAULT '',
    is_public INTEGER DEFAULT 0,
    is_open INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    create_time TEXT NOT NULL,
    update_time TEXT NOT NULL,
    UNIQUE(uid, slug)
  );
  CREATE TABLE tool_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_url TEXT NOT NULL,
    model_key TEXT NOT NULL,
    model_label TEXT NOT NULL,
    description TEXT,
    credit_cost INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(tool_url, model_key)
  );
`)

// 造数：与生产一致的 6 个模型 + 已有 agnes 厂商
db.prepare(`INSERT INTO ai_providers (uid,name,slug,base_url,api_key,is_public,status,create_time,update_time)
  VALUES ('','Agnes AI','agnes','https://apihub.agnes-ai.cn/v1','agnes-key',1,1,datetime('now'),datetime('now'))`).run()
const seedModels = [
  ['/ai-image-edit/', 'gpt-image-2-1k', 'gpt-image-2 1k（标准）', 2],
  ['/ai-image-edit/', 'gpt-image-2.5-1k', 'gpt-image-2.5', 2],
  ['/ai-image-edit/', 'gpt-image2-超分', 'gpt-image-2 超分（高清）', 6],
  ['/ai-outfit/', 'gemini-3-pro-image-preview', 'Gemini 3 Pro Image Preview', 19],
  ['/ai-outfit/', 'gemini-3.1-flash-image-preview', 'Gemini 3.1 Flash Image Preview', 13],
  ['/ai-outfit/', 'gpt-image-2-1k', 'GPT Image 2（1K）', 2],
]
for (const [url, key, label, cost] of seedModels) {
  db.prepare(`INSERT INTO tool_models (tool_url,model_key,model_label,credit_cost,created_at,updated_at)
    VALUES (?,?,?,?,datetime('now'),datetime('now'))`).run(url, key, label, cost)
}

// 执行 migration（跳过 ALTER 的重复执行报错 → 单独跑）
const sql = readFileSync(new URL('../migrations/111_tool_models_upstreams.sql', import.meta.url), 'utf8')
db.exec('ALTER TABLE tool_models ADD COLUMN upstreams TEXT;')
const restSql = sql.split(';').slice(1).map(s => s.trim()).filter(Boolean).join(';\n') + ';'

let failed = 0
const t = (name, cond) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) failed++ }

// 第一次执行
db.exec(restSql)
{
  const rows = db.prepare('SELECT tool_url, model_key, upstreams FROM tool_models').all()
  t('6 行全部回填', rows.length === 6 && rows.every(r => r.upstreams))
  const chao = rows.find(r => r.model_key === 'gpt-image2-超分')
  t('中文 model_key 回填正确',
    chao.upstreams === '[{"provider":"bafang","model_id":"gpt-image2-超分","style":"auto"}]')
  const providers = db.prepare('SELECT slug, base_url, api_key FROM ai_providers ORDER BY id').all()
  t('bafang 厂商已注册（key 留空）', providers.some(p => p.slug === 'bafang' && p.api_key === '' && p.base_url === 'https://bafang.me'))
  t('agnes 厂商不受影响', providers.some(p => p.slug === 'agnes' && p.api_key === 'agnes-key'))
}

// 幂等性：再执行一次（除 ALTER 外不应重复插入/破坏数据）
db.exec(restSql)
{
  const bafangCount = db.prepare(`SELECT COUNT(*) AS n FROM ai_providers WHERE slug = 'bafang'`).get()
  t('重复执行不重复插入 bafang', bafangCount.n === 1)
  const rows = db.prepare('SELECT upstreams FROM tool_models').all()
  t('重复执行不破坏回填值', rows.every(r => r.upstreams && r.upstreams.includes('"provider":"bafang"')))
}

console.log(failed ? `\n结果: ${failed} failed` : '\n结果: all passed')
process.exit(failed ? 1 : 0)
