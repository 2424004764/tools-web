// 站点配置公开接口（只读，只暴露前台需要的键）
// GET /api/site-config?config_key=comment_system  → { data: { comment_system } }
// GET /api/site-config?config_key=giscus          → { data: { repo, repo_id, category, category_id, mapping } }
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
]

const DEFAULTS = {
  comment_system: 'giscus',
  giscus_repo: '',
  giscus_repo_id: '',
  giscus_category: 'General',
  giscus_category_id: '',
  giscus_mapping: 'title',
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
  if (configKey !== 'comment_system' && configKey !== 'giscus') {
    return ApiResponse.error(`不支持的 config_key: ${configKey}`, origin, 400)
  }

  try {
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
    // 配置表缺失等异常时按默认 giscus 行为兜底，不影响前台
    if (configKey === 'comment_system') {
      return ApiResponse.success({ data: { comment_system: 'giscus' } }, origin)
    }
    return ApiResponse.success({ data: buildGiscusPayload(DEFAULTS, true) }, origin)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
