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
    remark: '评论系统类型：giscus = GitHub 评论（默认），custom = 自建评论（需审核后展示），disabled = 关闭全部评论',
    validate: (v) => (['giscus', 'custom', 'disabled'].includes(v) ? v : null),
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
  products_matrix: {
    remark:
      '「更多产品」矩阵，JSON 数组：[{"key":"tiji","name":"题迹","desc":"一句话简介","url":"https://xxx","logo":"/images/logo/product-tiji.svg","enabled":true}]；key 为站内跳转白名单（小写字母/数字/连字符，全局唯一），enabled=false 隐藏该项，全部隐藏时前台不展示「更多产品」入口；留空 = 使用内置默认',
    validate: validateProductsMatrix,
  },
  admin_dashboard_layout: {
    remark:
      '管理后台仪表盘卡片顺序，JSON 数组（元素为卡片 id），如 ["users","disabled","credits","tools","usage","topTools","slowlog","pending","transactions"]；只校验格式（卡片 id 由前端代码维护），未出现的卡片由前端按默认顺序补尾；留空 = 使用内置默认顺序',
    validate: validateDashboardLayout,
  },
}

// 校验仪表盘卡片顺序：JSON 字符串数组（id 去重、单个 ≤40 字符、总数 ≤50）；'' = 恢复默认顺序
function validateDashboardLayout(v) {
  const raw = String(v ?? '').trim()
  if (raw === '') return ''

  let arr
  try {
    arr = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(arr) || arr.length > 50) return null

  const seen = new Set()
  for (const item of arr) {
    if (typeof item !== 'string' || !/^[\w-]{1,40}$/.test(item) || seen.has(item)) return null
    seen.add(item)
  }
  return JSON.stringify(arr)
}

// 校验并归一化「更多产品」JSON 配置
// 入参为任意值，返回归一化后的紧凑 JSON 字符串；'' = 未配置（前台用内置默认），null = 不合法
function validateProductsMatrix(v) {
  const raw = String(v ?? '').trim()
  if (raw === '') return ''

  let arr
  try {
    arr = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(arr) || arr.length > 50) return null

  const seen = new Set()
  const out = []
  for (const item of arr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const key = String(item.key ?? '').trim().toLowerCase()
    if (!/^[a-z0-9-]{1,40}$/.test(key) || seen.has(key)) return null
    const name = String(item.name ?? '').trim()
    if (!name || name.length > 30) return null
    const desc = String(item.desc ?? '').trim()
    if (desc.length > 60) return null
    const url = String(item.url ?? '').trim()
    if (!/^https?:\/\/\S+$/i.test(url)) return null
    const logo = String(item.logo ?? '').trim()
    if (!/^(https?:\/\/\S+|\/\S+)$/i.test(logo)) return null
    seen.add(key)
    // enabled 缺省视为开启，显式 false 才隐藏
    out.push({ key, name, desc, url, logo, enabled: item.enabled !== false })
  }
  return JSON.stringify(out)
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
