// AI 模型配置共享库
// 提供：resolveModel / renderTemplate / extractByPath / parseCapabilities

/**
 * 从 D1 查询指定 model_key 的完整模型配置
 * @param {D1Database} db
 * @param {string} modelKey 业务唯一键，如 'agnes/agnes-2.0-flash'
 * @param {string|null} uid 用户 UID（用于访问私有模型）
 * @returns {Promise<{provider: object, model: object, endpoints: object, inputTemplate: object, outputPaths: object, apiKey: string} | null>}
 */
export async function resolveModel(db, modelKey, uid) {
  if (!modelKey) return null

  const isAdminUser = await isAdmin(db, uid)
  const vis = buildModelVisibilityClause(uid, isAdminUser)

  // 查询：模型必须启用，所属厂商必须启用，且满足可见性规则
  const result = await db.prepare(`
    SELECT
      m.id AS model_id,
      m.uid AS model_uid,
      m.is_public AS model_is_public,
      m.name AS model_name,
      m.model_key,
      m.model_id AS vendor_model_id,
      m.capabilities,
      m.endpoints,
      m.input_template,
      m.output_paths,
      m.status AS model_status,
      p.id AS provider_id,
      p.uid AS provider_uid,
      p.name AS provider_name,
      p.slug AS provider_slug,
      p.base_url,
      p.api_key,
      p.is_public,
      p.is_open,
      p.status AS provider_status
    FROM ai_models m
    INNER JOIN ai_providers p ON p.id = m.provider_id
    WHERE m.model_key = ?
      AND ${vis.sql}
  `).bind(modelKey, ...vis.args).first()

  if (!result) return null

  return {
    provider: {
      id: result.provider_id,
      uid: result.provider_uid,
      name: result.provider_name,
      slug: result.provider_slug,
      base_url: result.base_url,
      is_public: !!result.is_public,
      is_open: !!result.is_open,
    },
    model: {
      id: result.model_id,
      uid: result.model_uid,
      name: result.model_name,
      model_key: result.model_key,
      model_id: result.vendor_model_id,
      capabilities: parseCapabilities(result.capabilities),
    },
    endpoints: safeJsonParse(result.endpoints, {}),
    inputTemplate: safeJsonParse(result.input_template, {}),
    outputPaths: safeJsonParse(result.output_paths, {}),
    apiKey: result.api_key || '',
  }
}

/**
 * 解析 capabilities 字符串为数组
 */
export function parseCapabilities(str) {
  try {
    const arr = JSON.parse(str)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/**
 * 安全 JSON 解析
 */
function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

/**
 * 渲染入参模板
 * @param {object} template 模板对象
 * @param {object} params 参数对象
 * @returns {object} 渲染后的请求体
 */
export function renderTemplate(template, params) {
  if (template == null) return {}
  if (typeof template !== 'object') return template

  // 数组：递归
  if (Array.isArray(template)) {
    return template
      .map(t => renderTemplate(t, params))
      .filter(item => item == null || !(typeof item === 'object' && item.__omit))
  }

  // 关键字指令
  if ('$const' in template) return template.$const
  if ('$ref' in template) {
    const value = params[template.$ref]
    if (template.$omitIfEmpty && (value == null || value === '' ||
        (Array.isArray(value) && value.length === 0))) {
      return { __omit: true }
    }
    return value
  }
  if ('$fn' in template) {
    return applyFn(template.$fn, template.args || [], params)
  }
  if ('$if' in template) {
    const cond = params[template.$if]
    return cond
      ? renderTemplate(template.then, params)
      : renderTemplate(template.else, params)
  }

  // 普通对象：递归 + 点号路径 + omit 字段
  const out = {}
  for (const [key, value] of Object.entries(template)) {
    const resolved = renderTemplate(value, params)
    if (resolved == null) continue
    if (typeof resolved === 'object' && resolved.__omit) continue

    if (key.includes('.')) {
      // 点号路径嵌套：extra_body.response_format
      const parts = key.split('.')
      let cur = out
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') {
          cur[parts[i]] = {}
        }
        cur = cur[parts[i]]
      }
      cur[parts[parts.length - 1]] = resolved
    } else {
      out[key] = resolved
    }
  }
  return out
}

/**
 * 应用白名单函数
 */
function applyFn(name, args, params) {
  // 把参数名替换为实际值
  const resolved = args.map(a =>
    typeof a === 'string' && params[a] !== undefined ? params[a] : a
  )

  switch (name) {
    case 'join':
      // join(width, height, separator) → "${width}${separator}${height}"
      if (resolved.length >= 3) {
        return `${resolved[0]}${resolved[2]}${resolved[1]}`
      }
      return resolved.join('')
    case 'concat':
      return resolved.join('')
    case 'pick':
      // pick(obj, "key1", "key2") → {key1: obj.key1, key2: obj.key2}
      const obj = resolved[0] || {}
      const keys = resolved.slice(1)
      const picked = {}
      keys.forEach(k => { if (obj[k] !== undefined) picked[k] = obj[k] })
      return picked
    case 'toNumber':
      return Number(resolved[0])
    case 'wrap':
      // wrap(value) → [value]，把单值包成数组（用于 image_edit 等要求数组字段的场景）
      return [resolved[0]]
    default:
      return null
  }
}

/**
 * 按简化 JSONPath 抽取字段
 * 支持格式：$.a.b[0].c、$.data[0].url、$、a.b.c
 * @param {object} obj 目标对象
 * @param {string} path 路径
 * @returns {*} 抽取的值，找不到返回 undefined
 */
export function extractByPath(obj, path) {
  if (!path) return undefined
  if (path === '$' || path === '') return obj

  // 去掉开头的 $.
  let p = path.replace(/^\$\.?/, '')

  // 解析 token：[a][0].b.c → ['a','0','b','c']
  const tokens = []
  const re = /([^.[\]]+)|\[(\d+)\]/g
  let m
  while ((m = re.exec(p)) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2])
  }

  let cur = obj
  for (const t of tokens) {
    if (cur == null) return undefined
    cur = cur[t]
  }
  return cur
}

/**
 * 拼接完整 URL
 * @param {string} baseUrl 基础 URL
 * @param {string} path 端点路径
 * @param {string|null} queryTemplate 查询参数模板，如 "video_id={video_id}"
 * @param {object} params 参数对象
 * @returns {string} 完整 URL
 */
export function buildUrl(baseUrl, path, queryTemplate, params) {
  let url = baseUrl.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path)

  if (queryTemplate) {
    // 替换 {paramName} 占位符
    const query = queryTemplate.replace(/\{(\w+)\}/g, (_, name) => {
      const v = params[name]
      return encodeURIComponent(v != null ? v : '')
    })
    url += (url.includes('?') ? '&' : '?') + query
  }
  return url
}

/**
 * 从 Authorization header 中提取 uid
 * @param {Request} request
 * @returns {string} uid（空字符串表示未登录）
 */
export function extractUidFromRequest(request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return ''
  const token = authHeader.substring(7)
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return ''
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp * 1000 <= Date.now()) return ''
    return payload.uid || ''
  } catch {
    return ''
  }
}

/**
 * 查当前 uid 是否管理员（同步 D1 查询，调用方记得缓存或自行优化）
 * @param {D1Database} db
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function isAdmin(db, uid) {
  if (!uid) return false
  const row = await db.prepare(`SELECT is_admin FROM user WHERE id = ?`).bind(uid).first()
  return !!row?.is_admin
}

/**
 * 构造 AI 模型可见性 WHERE 子句
 * - 管理员：可见所有启用模型
 * - 登录用户：管理员公开模型（uid='' AND is_public=1）∪ 自己的模型（uid=自己）
 * - 游客（uid='' 且未登录）：仅管理员公开模型（uid='' AND is_public=1）
 */
export function buildModelVisibilityClause(uid, isAdminUser) {
  if (isAdminUser) {
    return {
      sql: `m.status = 1 AND p.status = 1`,
      args: []
    }
  }
  if (!uid) {
    // 游客：只看 is_public=1 的管理员模型
    return {
      sql: `m.status = 1 AND p.status = 1
            AND m.uid = '' AND m.is_public = 1 AND p.is_public = 1`,
      args: []
    }
  }
  // 登录用户：管理员公开模型 OR 自己的模型
  return {
    sql: `m.status = 1 AND p.status = 1
          AND (
            (m.uid = '' AND m.is_public = 1 AND p.is_public = 1)
            OR m.uid = ?
          )`,
    args: [uid]
  }
}

/**
 * 构造 AI 厂商可见性 WHERE 子句
 */
export function buildProviderVisibilityClause(uid, isAdminUser) {
  if (isAdminUser) {
    return {
      sql: `status = 1`,
      args: []
    }
  }
  if (!uid) {
    // 游客：仅公开厂商
    return {
      sql: `status = 1 AND is_public = 1`,
      args: []
    }
  }
  // 登录用户：公开厂商 OR 自己的私有厂商
  return {
    sql: `status = 1 AND (is_public = 1 OR uid = ?)`,
    args: [uid]
  }
}