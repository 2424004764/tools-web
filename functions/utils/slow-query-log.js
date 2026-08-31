/**
 * 慢查询日志 — 写入工具
 *
 * 配合 migrations/068_create_slow_query_logs.sql 使用。
 *
 * 设计原则（与 functions/utils/error-log.js 保持一致）：
 *  1. 日志写入失败绝不能影响主请求 —— 所有异常在内部吞掉，只 console.error
 *  2. 调用方负责把返回的 Promise 交给 context.waitUntil(...) —— 不在工具内部 waitUntil
 *  3. 阈值/开关通过 env 注入，工具自身不主动读取环境变量外的全局状态
 *
 * 写入策略：
 *   仅当 duration_ms 超过阈值时才记一条。普通 SQL 不写，避免日志表爆炸。
 */

// 阈值默认 100ms；调用方可通过 env.SLOW_QUERY_THRESHOLD_MS 覆盖（字符串数字）
export const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 100

// 单条 SQL / 参数最大长度限制，避免单条日志过大撑爆 D1
const MAX_SQL_LENGTH = 4000
const MAX_PARAMS_LENGTH = 2000
const MAX_PARAMS_COUNT = 50
const MAX_ERROR_LENGTH = 1000

function truncate(value, max) {
  if (value === null || value === undefined) return null
  const str = typeof value === 'string' ? value : String(value)
  if (!str) return null
  return str.length > max ? `${str.slice(0, max)}…[truncated]` : str
}

/**
 * 从 SQL 中粗略提取操作类型与表名。
 * 仅做最基础的解析，目标是能按"操作 + 表"聚合，不保证覆盖所有边缘语法。
 *
 * @param {string} sql
 * @returns {{ operation: string|null, tableName: string|null }}
 */
export function parseSqlMeta(sql) {
  if (!sql || typeof sql !== 'string') {
    return { operation: null, tableName: null }
  }
  // 去掉行注释与块注释，避免 FROM /* ... */ table 这种干扰
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const upper = cleaned.toUpperCase()
  let operation = 'OTHER'
  let tableName = null

  // 操作类型：取首关键字（WITH ... SELECT 视作 SELECT）
  if (upper.startsWith('WITH ')) {
    operation = 'SELECT'
  } else {
    const firstToken = upper.split(' ', 1)[0]
    if (['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'CREATE', 'DROP', 'ALTER'].includes(firstToken)) {
      operation = firstToken
    }
  }

  // 表名：从 FROM / INTO / UPDATE / TABLE 后的第一个标识符
  const patterns = [
    /\bFROM\s+[`"[]?([A-Za-z_][A-Za-z0-9_]*)[`"\]]?/i,
    /\bINTO\s+[`"[]?([A-Za-z_][A-Za-z0-9_]*)[`"\]]?/i,
    /\bUPDATE\s+[`"[]?([A-Za-z_][A-Za-z0-9_]*)[`"\]]?/i,
    /\bTABLE\s+[`"[]?([A-Za-z_][A-Za-z0-9_]*)[`"\]]?/i,
  ]
  for (const re of patterns) {
    const m = cleaned.match(re)
    if (m && m[1]) {
      // 排除常见关键字误命中
      const word = m[1]
      if (!/^(SELECT|INSERT|UPDATE|DELETE|FROM|INTO|TABLE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|WHERE|SET|VALUES)$/i.test(word)) {
        tableName = word
        break
      }
    }
  }

  return { operation, tableName }
}

/**
 * 把 bind 参数序列化为可入库的字符串。数组对象用 JSON.stringify，
 * 长度超过 MAX_PARAMS_LENGTH 一律截断；超过 MAX_PARAMS_COUNT 个则只取前 N 个。
 */
function serializeParams(params) {
  if (params === null || params === undefined) return null
  if (!Array.isArray(params)) {
    try {
      return truncate(JSON.stringify([params]), MAX_PARAMS_LENGTH)
    } catch {
      return null
    }
  }
  const sliced = params.length > MAX_PARAMS_COUNT ? params.slice(0, MAX_PARAMS_COUNT) : params
  let text
  try {
    text = JSON.stringify(sliced)
  } catch {
    return null
  }
  if (params.length > MAX_PARAMS_COUNT) {
    text = text.replace(/]$/, `]…[truncated ${params.length - MAX_PARAMS_COUNT} more]`)
  }
  return truncate(text, MAX_PARAMS_LENGTH)
}

/**
 * 读取阈值；env 缺失或非法时回退到默认值。
 */
function readThreshold(env) {
  const raw = env && env.SLOW_QUERY_THRESHOLD_MS
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_SLOW_QUERY_THRESHOLD_MS
  return n
}

/**
 * 判断功能是否启用。
 *   env.SLOW_QUERY_ENABLED === '0' 或 'false' → 关闭
 *   其他情况（含未配置）→ 启用
 */
export function isSlowQueryLogEnabled(env) {
  if (!env) return true
  const v = env.SLOW_QUERY_ENABLED
  if (v === '0' || v === 'false' || v === 'FALSE') return false
  return true
}

function genId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `slow_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  }
}

/**
 * 写一条慢查询日志。永不抛异常。
 *
 * 调用方应自行：
 *   1) 仅在 duration_ms >= threshold 时调用本函数
 *   2) 把返回的 Promise 交给 context.waitUntil(...) 异步执行
 *
 * @param {object} env 需含 env.DB；env.SLOW_QUERY_THRESHOLD_MS 可选覆盖阈值
 * @param {object} payload
 * @returns {Promise<void>}
 */
export async function logSlowQuery(env, payload = {}) {
  try {
    if (!env || !env.DB) return

    const {
      sqlText = '',
      params = null,
      durationMs = 0,
      operation = null,
      tableName = null,
      path = null,
      method = null,
      uid = null,
      source = null,
      error = null,
    } = payload

    if (!sqlText || typeof durationMs !== 'number') return

    await env.DB.prepare(
      `INSERT INTO slow_query_logs
         (id, sql_text, params, operation, table_name,
          duration_ms, path, method, uid, source, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      genId(),
      truncate(sqlText, MAX_SQL_LENGTH),
      serializeParams(params),
      operation || null,
      tableName || null,
      durationMs,
      path || null,
      method || null,
      uid || null,
      source || null,
      truncate(error, MAX_ERROR_LENGTH),
      new Date().toISOString().slice(0, 19).replace('T', ' '),
    )
    .run()
  } catch (e) {
    console.error('logSlowQuery failed:', e)
  }
}

/**
 * 给定 env + 耗时，返回是否应该记日志（同时返回阈值）。
 * 统一在一处判断，方便调用方使用。
 */
export function shouldLogSlowQuery(env, durationMs) {
  if (!isSlowQueryLogEnabled(env)) return { enabled: false, threshold: 0 }
  const threshold = readThreshold(env)
  return { enabled: durationMs >= threshold, threshold }
}

export { readThreshold as _readThreshold }
