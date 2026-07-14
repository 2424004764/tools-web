/**
 * 全局中间件 — 统一处理 CORS 与基础安全头
 *
 * 职责：
 *  1. 对受保护路径（/api/*、OAuth 回调、短链接）注入白名单 CORS 头
 *  2. OPTIONS 预检统一走 cors.js 的 handleCORSPreflight
 *  3. 给所有响应添加 X-Content-Type-Options / X-Frame-Options / Referrer-Policy
 *
 * 设计说明：
 *  - 中间件不会向同源请求（无 Origin 头）注入 CORS 头，避免污染响应
 *  - 端点无需再手写 Access-Control-Allow-Origin；middleware 会统一覆盖
 *  - 端点应继续保留 Content-Type / Cache-Control 等业务相关头
 */

import { getCORSHeaders, handleCORSPreflight } from './utils/cors.js'

// 需要走 CORS 处理的路径前缀
const CORS_PROTECTED_PREFIXES = [
  '/api/',
  '/google-auth',
  '/github-auth',
  '/gitee-auth',
  '/qq-auth',
  '/linuxdo-auth',
  '/s/',
]

function needsCORS(path) {
  return CORS_PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p))
}

// 给任意响应附加基础安全头
function withSecurityHeaders(response) {
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export async function onRequest(context) {
  const { request } = context
  const origin = request.headers.get('Origin')
  const path = new URL(request.url).pathname

  // 非受保护路径直接走原逻辑
  if (!needsCORS(path)) {
    return withSecurityHeaders(await context.next())
  }

  // OPTIONS 预检：白名单校验通过则放行，否则 403
  if (request.method === 'OPTIONS') {
    return handleCORSPreflight(origin)
  }

  const response = await context.next()

  // 同源请求（无 Origin 头）：不注入 CORS，但保留安全头
  if (!origin) return withSecurityHeaders(response)

  // 跨源请求：用白名单统一覆盖 Access-Control-Allow-Origin
  const corsHeaders = getCORSHeaders(origin)
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(corsHeaders)) {
    headers.set(k, v)
  }
  // 兜底覆盖：无论端点是否手写了 CORS 头，middleware 都强制走白名单
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}