// 站点配置公开接口（只读，只暴露前台需要的键）
// GET /api/site-config  → { comment_system, giscus: { repo, repo_id, category, category_id, mapping } }
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

  try {
    const rows = await db.prepare(`SELECT key, value FROM site_config`).all()
    const map = { ...DEFAULTS }
    for (const row of rows.results || []) {
      if (PUBLIC_KEYS.includes(row.key) && row.value != null && row.value !== '') {
        map[row.key] = row.value
      }
    }

    return ApiResponse.success(
      {
        data: {
          comment_system: map.comment_system === 'custom' ? 'custom' : 'giscus',
          giscus: {
            repo: map.giscus_repo,
            repo_id: map.giscus_repo_id,
            category: map.giscus_category,
            category_id: map.giscus_category_id,
            mapping: map.giscus_mapping,
          },
        },
      },
      origin,
    )
  } catch (error) {
    console.error('site-config API error:', error)
    // 配置表缺失时回退到默认 giscus 行为，不影响前台
    return ApiResponse.success(
      {
        data: {
          comment_system: 'giscus',
          giscus: {
            repo: DEFAULTS.giscus_repo,
            repo_id: DEFAULTS.giscus_repo_id,
            category: DEFAULTS.giscus_category,
            category_id: DEFAULTS.giscus_category_id,
            mapping: DEFAULTS.giscus_mapping,
          },
        },
      },
      origin,
    )
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}
