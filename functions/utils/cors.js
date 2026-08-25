// 允许的前端来源配置
export const allowedOrigins = [
  'https://tool.fologde.com',  // 生产环境前端
  'http://127.0.0.1:5173',    // 本地开发调试
  'http://127.0.0.1:8788',    // 本地开发调试（直连 Functions）
  'http://localhost:5173',    // 本地开发调试
  'http://localhost:8788',    // 本地开发调试（直连 Functions）
]

// 开发期放宽：任何 127.0.0.1 / localhost / ::1 都视为合法
const DEV_LOOPBACK = /^(https?:\/\/)(127\.0\.0\.1|localhost|::1)(:\d+)?$/

/**
 * 校验请求来源是否允许
 * @param {string} origin 请求来源
 * @returns {boolean} 是否允许
 */
export function isOriginAllowed(origin) {
  if (!origin) return false
  if (allowedOrigins.includes(origin)) return true
  if (DEV_LOOPBACK.test(origin)) return true
  return false
}

/**
 * 获取CORS响应头
 * - 若 origin 在白名单内（含 dev loopback），原样回传（浏览器才会接受）
 * - 否则 fallback 到白名单第一项（生产域名），浏览器侧仍会被拒绝
 * @param {string|null} origin 请求来源
 * @returns {object} CORS响应头对象
 */
export function getCORSHeaders(origin) {
  const allowedOrigin = isOriginAllowed(origin) ? origin : allowedOrigins[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Idempotency-Key',
    // Retry-After 等非安全列表响应头需显式暴露，前端才能读到（限流倒计时用）
    'Access-Control-Expose-Headers': 'Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * 处理OPTIONS预检请求
 * @param {string} origin 请求来源
 * @returns {Response} 预检响应
 */
export function handleCORSPreflight(origin) {
  if (isOriginAllowed(origin)) {
    return new Response(null, {
      status: 204,
      headers: getCORSHeaders(origin)
    })
  } else {
    return new Response('CORS origin not allowed', { status: 403 })
  }
}

/**
 * 为API响应添加CORS头
 * @param {any} data 响应数据
 * @param {string} origin 请求来源
 * @param {number} status HTTP状态码
 * @returns {Response} 带CORS头的响应
 */
export function createCORSResponse(data, origin, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCORSHeaders(origin)
    }
  })
}

/**
 * 创建CORS错误响应
 * @param {string} message 错误消息
 * @param {string} origin 请求来源
 * @param {number} status HTTP状态码
 * @returns {Response} 错误响应
 */
export function createCORSErrorResponse(message, origin, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCORSHeaders(origin)
    }
  })
}
