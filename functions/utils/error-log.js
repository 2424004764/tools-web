/**
 * API 错误日志 — 写入工具
 *
 * 配合 migrations/034_create_api_error_logs.sql 与 functions/_middleware.js 使用。
 *
 * 设计原则：
 *  1. 日志写入失败绝不能影响主请求 —— 所有异常在内部吞掉，只 console.error
 *  2. 中间件能自动拿到的信息（path/method/status/ip/ua/耗时）不需要业务代码关心
 *  3. 中间件拿不到的上游细节（如 Resend 返回的 401 + 错误体），
 *     由业务代码通过 attachUpstreamError() 主动挂到 context 上
 */

// 上游响应体最多存这么长，避免单条日志过大撑爆 D1
const MAX_UPSTREAM_BODY = 2000
const MAX_ERROR_MESSAGE = 500
const MAX_ERROR_STACK = 4000
const MAX_USER_AGENT = 300

/** 挂载点的 key，中间件与业务代码约定一致 */
export const UPSTREAM_ERROR_KEY = '__upstreamError'

function truncate(value, max) {
  if (value === null || value === undefined) return null
  const str = typeof value === 'string' ? value : String(value)
  if (!str) return null
  return str.length > max ? `${str.slice(0, max)}…[truncated]` : str
}

/**
 * 生成日志 ID。Workers 运行时支持 crypto.randomUUID()，
 * 极端情况下降级为时间戳 + 随机数。
 */
function genId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `err_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  }
}

/**
 * 业务代码在返回错误响应前调用，把中间件看不到的细节挂上去。
 * 中间件在落库时会自动合并这些字段。
 *
 * @example
 *   attachUpstreamError(context, {
 *     stage: 'upstream',
 *     upstreamName: 'resend',
 *     upstreamStatus: 401,
 *     upstreamBody: '{"message":"API key is invalid"}',
 *     extra: { email, type },
 *   })
 *
 * @param {object} context Pages Functions 的 context 对象
 * @param {object} detail
 */
export function attachUpstreamError(context, detail) {
  if (!context || !detail) return
  try {
    if (typeof context.data !== 'object' || context.data === null) {
      context.data = {}
    }
    context.data[UPSTREAM_ERROR_KEY] = detail
  } catch (e) {
    console.error('attachUpstreamError failed:', e)
  }
}

/**
 * 写一条错误日志。永不抛异常。
 *
 * @param {object} env 需含 env.DB
 * @param {object} payload
 * @returns {Promise<void>}
 */
export async function logApiError(env, payload = {}) {
  try {
    if (!env || !env.DB) return

const {
      path,
      method,
      status,
      errorMessage = null,
      errorStack = null,
      stage = null,
      upstreamName = null,
      upstreamStatus = null,
      upstreamBody = null,
      uid = null,
      clientIp = null,
      country = null,
      region = null,
      city = null,
      timezone = null,
      colo = null,
      userAgent = null,
      durationMs = null,
      extra = null,
    } = payload

    if (!path || !method || !status) return

    let extraText = null
    if (extra !== null && extra !== undefined) {
      try {
        extraText = typeof extra === 'string' ? extra : JSON.stringify(extra)
      } catch {
        extraText = null
      }
    }

    await env.DB.prepare(
      `INSERT INTO api_error_logs
         (id, path, method, status, error_message, error_stage,
          upstream_name, upstream_status, upstream_body,
          uid, client_ip, country, region, city, timezone, colo,
          user_agent, duration_ms, extra, error_stack, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      genId(),
      path,
      method,
      status,
      truncate(errorMessage, MAX_ERROR_MESSAGE),
      stage || 'unknown',
      upstreamName,
      typeof upstreamStatus === 'number' ? upstreamStatus : null,
      truncate(upstreamBody, MAX_UPSTREAM_BODY),
      uid || null,
      clientIp,
      country || null,
      region || null,
      city || null,
      timezone || null,
      colo || null,
      truncate(userAgent, MAX_USER_AGENT),
      typeof durationMs === 'number' ? durationMs : null,
      truncate(extraText, MAX_UPSTREAM_BODY),
      truncate(errorStack, MAX_ERROR_STACK),
      // 与项目其他表保持一致：UTC 字符串、空格分隔、无 Z 后缀
      // 前端 formatTime 会按 UTC 解析再 toLocaleString('zh-CN') 转北京时
      new Date().toISOString().slice(0, 19).replace('T', ' '),
    )
    .run()
  } catch (e) {
    // 日志失败只记控制台，绝不影响主请求
    console.error('logApiError failed:', e)
  }
}
