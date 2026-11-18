// 站点配置公开接口（只读，只暴露前台需要的键）
// GET /api/site-config?config_key=comment_system  → { data: { comment_system } }
// GET /api/site-config?config_key=giscus          → { data: { repo, repo_id, category, category_id, mapping } }
// GET /api/site-config?config_key=recharge        → { data: { mode, qq, packages } }
// GET /api/site-config（不带 config_key）          → { data: {} }（不做全量返回，需要哪个传哪个）
// 前端按需两段式请求：先拿 comment_system，等于 giscus 时再拉 giscus 配置。
import { ApiResponse, initDatabase } from '../utils/db.js'

// 允许公开的配置键白名单（其余键一律不返回）
const PUBLIC_KEYS = [
  'comment_system',
  'giscus_repo',
  'giscus_repo_id',
  'giscus_category',
  'giscus_category_id',
  'giscus_mapping',
  'recharge_mode',
  'recharge_contact_qq',
  'recharge_packages',
]

const DEFAULTS = {
  comment_system: 'giscus',
  giscus_repo: '',
  giscus_repo_id: '',
  giscus_category: 'General',
  giscus_category_id: '',
  giscus_mapping: 'title',
  recharge_mode: 'faka',
  recharge_contact_qq: '',
  recharge_packages: '',
}

// 归一化评论系统类型（白名单外一律视为默认 giscus）
function normalizeSystem(value) {
  return value === 'custom' || value === 'disabled' ? value : 'giscus'
}

// 数据最小化：仅 giscus 模式返回真实 giscus 参数，其余模式一律置空
function buildGiscusPayload(map, include) {
  return include
    ? {
        repo: map.giscus_repo,
        repo_id: map.giscus_repo_id,
        category: map.giscus_category,
        category_id: map.giscus_category_id,
        mapping: map.giscus_mapping,
      }
    : { repo: '', repo_id: '', category: '', category_id: '', mapping: 'title' }
}

async function loadMap(db) {
  const rows = await db.prepare(`SELECT key, value FROM site_config`).all()
  const map = { ...DEFAULTS }
  for (const row of rows.results || []) {
    if (PUBLIC_KEYS.includes(row.key) && row.value != null && row.value !== '') {
      map[row.key] = row.value
    }
  }
  return map
}

export async function onRequest(context) {
  const { request, env } = context
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }
  if (request.method !== 'GET') {
    return ApiResponse.error('不支持的请求方法', origin, 405)
  }

  const dbInit = initDatabase(env, context.waitUntil)
  if (!dbInit.success) return dbInit.response
  const db = dbInit.db

  // config_key 必传：不传直接返回空数据，不做全量返回
  const configKey = new URL(request.url).searchParams.get('config_key')
  if (!configKey) {
    return ApiResponse.success({ data: {} }, origin)
  }
  if (
    configKey !== 'comment_system' &&
    configKey !== 'giscus' &&
    configKey !== 'products' &&
    configKey !== 'recharge'
  ) {
    return ApiResponse.error(`不支持的 config_key: ${configKey}`, origin, 400)
  }

  try {
    if (configKey === 'products') {
      // 「更多产品」：未配置（null）时前端回退内置默认列表；配置为空数组表示全部隐藏
      const row = await db
        .prepare(`SELECT value FROM site_config WHERE key = 'products_matrix'`)
        .first()
      return ApiResponse.success({ data: { products: parseEnabledProducts(row?.value) } }, origin)
    }

    if (configKey === 'recharge') {
      // 充值页展示方式：mode = faka 展示套餐并跳发卡网，contact = 联系站长（仅此模式返回 QQ）
      const map = await loadMap(db)
      return ApiResponse.success({ data: buildRechargePayload(map) }, origin)
    }

    const map = await loadMap(db)
    const effectiveSystem = normalizeSystem(map.comment_system)

    if (configKey === 'comment_system') {
      return ApiResponse.success({ data: { comment_system: effectiveSystem } }, origin)
    }
    return ApiResponse.success(
      { data: buildGiscusPayload(map, effectiveSystem === 'giscus') },
      origin,
    )
  } catch (error) {
    console.error('site-config API error:', error)
    if (configKey === 'products') {
      // 配置表缺失等异常时回退 null，前端按内置默认展示，不影响前台
      return ApiResponse.success({ data: { products: null } }, origin)
    }
    if (configKey === 'recharge') {
      // 配置表缺失等异常时按默认发卡网模式兜底（套餐 null = 前端用内置默认）
      return ApiResponse.success({ data: buildRechargePayload(DEFAULTS) }, origin)
    }
    // 配置表缺失等异常时按默认 giscus 行为兜底，不影响前台
    if (configKey === 'comment_system') {
      return ApiResponse.success({ data: { comment_system: 'giscus' } }, origin)
    }
    return ApiResponse.success({ data: buildGiscusPayload(DEFAULTS, true) }, origin)
  }
}

// 解析 products_matrix 存储值，只保留 enabled 的产品；未配置/脏数据一律返回 null（= 用内置默认）
function parseEnabledProducts(raw) {
  if (!raw) return null
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return null
    return arr.filter((p) => p && typeof p === 'object' && p.enabled !== false)
  } catch {
    return null
  }
}

// 充值配置：数据最小化 —— contact 模式只返回 QQ（packages 置 null），
// faka 模式只返回套餐（qq 置空）；套餐未配置/脏数据返回 null（= 前端用内置默认）
function buildRechargePayload(map) {
  const mode = map.recharge_mode === 'contact' ? 'contact' : 'faka'
  if (mode === 'contact') {
    return { mode, qq: map.recharge_contact_qq || '', packages: null }
  }
  return { mode, qq: '', packages: parseRechargePackages(map.recharge_packages) }
}

// 防御性解析充值套餐：只保留字段齐全的合法条目，全部不合法则视为未配置
function parseRechargePackages(raw) {
  if (!raw) return null
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return null
    const list = arr
      .filter(
        (p) =>
          p && typeof p === 'object' &&
          typeof p.name === 'string' && p.name &&
          typeof p.url === 'string' && /^https?:\/\//i.test(p.url) &&
          Number(p.price) > 0 && Number.isSafeInteger(Number(p.credits)) && Number(p.credits) > 0,
      )
      .map((p) => ({
        id: String(p.id ?? p.url),
        name: String(p.name),
        price: Number(p.price),
        credits: Number(p.credits),
        url: String(p.url),
        tag: typeof p.tag === 'string' && p.tag ? p.tag : undefined,
      }))
    return list.length ? list : null
  } catch {
    return null
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
