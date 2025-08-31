// 允许的前端来源配置
export const allowedOrigins = [
  'https://tool.fologde.com',  // 生产环境前端
  'http://127.0.0.1:5173',    // 本地开发调试
  'http://127.0.0.1:8788',    // 本地开发调试  
  'http://localhost:5173'      // 本地开发调试
]

/**
 * 校验请求来源是否允许
 * @param {string} origin 请求来源
 * @returns {boolean} 是否允许
 */
export function isOriginAllowed(origin) {
  return allowedOrigins.includes(origin)
}

/**
 * 获取CORS响应头
 * @param {string} origin 请求来源
 * @returns {object} CORS响应头对象
 */
export function getCORSHeaders(origin) {
  const allowedOrigin = isOriginAllowed(origin) ? origin : allowedOrigins[0]
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400'
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
