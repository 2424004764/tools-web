// Admin 站点配置
// GET /api/admin/site-config  → { values: {key: value}, remarks: {key: remark} }
// PUT /api/admin/site-config  body: { key: value, ... } 仅接受白名单键，逐个 upsert（同步刷新备注）
// 备注属于代码维护的固定说明：每次写库都会刷新 remark 列，保证直接查表时各项含义可读。
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// 允许后台写入的配置键 → 固定备注 + 校验规则
const ALLOWED_KEYS = {
  comment_system: {
    remark: '评论系统类型：giscus = GitHub 评论（默认），custom = 自建评论（需审核后展示）',
    validate: (v) => (['giscus', 'custom'].includes(v) ? v : null),
  },
  giscus_repo: {
    remark: 'giscus 仓库，格式 owner/repo 或完整 GitHub 地址；留空回退环境变量 VITE_GIT_URL',
    validate: (v) => {
      // 允许完整 github URL 或 owner/repo 形式，统一归一为 owner/repo
      const m = String(v).match(/github\.com\/([\w.-]+)\/([\w.-]+)/)
      if (m) return `${m[1]}/${m[2].replace(/\.git$/, '')}`
      const short = String(v).match(/^([\w.-]+)\/([\w.-]+)$/)
      if (short) return `${short[1]}/${short[2]}`
      return String(v).trim() === '' ? '' : null
    },
  },
  giscus_repo_id: {
    remark: 'giscus Repo ID，giscus.app 配置页生成，R_ 开头',
    validate: (v) => (String(v).trim() === '' || /^R_[\w]{4,20}$/.test(String(v).trim()) ? String(v).trim() : null),
  },
  giscus_category: {
    remark: 'giscus 分类名（Category），如 General',
    validate: (v) => (String(v).trim().length <= 50 ? String(v).trim() : null),
  },
  giscus_category_id: {
    remark: 'giscus 分类 ID（Category ID），giscus.app 配置页生成，DIC_ 开头',
    validate: (v) => (String(v).trim() === '' || /^DIC[_\w]{5,40}$/.test(String(v).trim()) ? String(v).trim() : null),
  },
  giscus_mapping: {
    remark: 'giscus 页面映射方式（Mapping）：title / pathname / url / number',
    validate: (v) => (['title', 'pathname', 'url', 'number'].includes(v) ? v : null),
  },
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// 读取配置：values 为当前值，remarks 恒为代码元数据（权威来源）
async function loadConfig(db) {
  const rows = await db.prepare(`SELECT key, value FROM site_config`).all()
  const values = {}
  const remarks = {}
  for (const key of Object.keys(ALLOWED_KEYS)) {
    values[key] = ''
    remarks[key] = ALLOWED_KEYS[key].remark
  }
  for (const row of rows.results || []) {
    if (row.key in ALLOWED_KEYS) values[row.key] = row.value ?? ''
  }
  return { values, remarks }
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    if (request.method === 'GET') {
      return json(await loadConfig(db))
    }

    if (request.method === 'PUT') {
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)

      const updates = []
      for (const [key, rawValue] of Object.entries(body)) {
        if (!(key in ALLOWED_KEYS)) continue
        const value = ALLOWED_KEYS[key].validate(rawValue)
        if (value === null) return jsonError(`配置项 ${key} 的值不合法`, 400)
        updates.push([key, value, ALLOWED_KEYS[key].remark])
      }
      if (!updates.length) return jsonError('没有可保存的配置项', 400)

      for (const [key, value, remark] of updates) {
        await db
          .prepare(
            `INSERT INTO site_config (key, value, remark, updated_at)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value, remark = excluded.remark, updated_at = datetime('now')`,
          )
          .bind(key, value, remark)
          .run()
      }

      return json(await loadConfig(db))
    }

    return jsonError('不支持的请求方法', 405)
  } catch (error) {
    console.error('admin site-config error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
