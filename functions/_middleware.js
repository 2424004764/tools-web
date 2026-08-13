/**
 * 全局中间件 — 统一处理 CORS 与基础安全头
 *
 * 职责：
 *  1. 对受保护路径（/api/*、OAuth 回调、短链接）注入白名单 CORS 头
 *  2. OPTIONS 预检统一走 cors.js 的 handleCORSPreflight
 *  3. 给所有响应添加 X-Content-Type-Options / X-Frame-Options / Referrer-Policy
 *  4. 统一捕获 /api/* 的失败响应（status >= 400）并落库到 api_error_logs
 *
 * 设计说明：
 *  - 中间件不会向同源请求（无 Origin 头）注入 CORS 头，避免污染响应
 *  - 端点无需再手写 Access-Control-Allow-Origin；middleware 会统一覆盖
 *  - 端点应继续保留 Content-Type / Cache-Control 等业务相关头
 */

import { getCORSHeaders, handleCORSPreflight } from './utils/cors.js'
import { logApiError, UPSTREAM_ERROR_KEY } from './utils/error-log.js'
import { extractUidFromRequest } from './api/_lib/model-resolver.js'

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

// 错误日志自身相关的路径不记录，避免日志页故障时自我循环放大
const ERROR_LOG_EXCLUDED = ['/api/admin/error-logs']

function shouldLogError(path, status) {
  if (status < 400) return false
  if (!path.startsWith('/api/')) return false
  return !ERROR_LOG_EXCLUDED.some((p) => path === p || path.startsWith(`${p}/`))
}

/**
 * 从失败响应中提取错误信息并落库。
 *
 * ⚠️ 关键：必须用 response.clone() 读取 body。
 * Response body 是一次性流，直接 .text() 会消费掉它，
 * 导致后续返回给客户端的响应变成空体。
 *
 * 返回 Promise，由调用方交给 context.waitUntil()，不阻塞响应返回。
 */
async function captureApiError(context, response, path, startedAt) {
  const { request, env } = context

  let errorMessage = null
  try {
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      const text = await response.clone().text()
      if (text) {
        try {
          const parsed = JSON.parse(text)
          // 项目里两种错误响应外壳：{ error } 与 { success:false, error }
          errorMessage = parsed?.error || parsed?.message || null
        } catch {
          errorMessage = text
        }
      }
    }
  } catch (e) {
    console.error('captureApiError: read body failed:', e)
  }

  // 业务代码通过 attachUpstreamError() 挂上来的上游细节（中间件自身看不到）
  const detail = (context.data && context.data[UPSTREAM_ERROR_KEY]) || {}

  let uid = null
  try {
    uid = await extractUidFromRequest(request, env)
  } catch {
    uid = null
  }

  await logApiError(env, {
    path,
    method: request.method,
    status: response.status,
    errorMessage,
    stage: detail.stage || null,
    upstreamName: detail.upstreamName || null,
    upstreamStatus: detail.upstreamStatus ?? null,
    upstreamBody: detail.upstreamBody || null,
    uid,
    clientIp: request.headers.get('CF-Connecting-IP') || null,
    userAgent: request.headers.get('User-Agent') || null,
    durationMs: Date.now() - startedAt,
    extra: detail.extra || null,
  })
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
  const path = new URL(request.url).pathname
  const startedAt = Date.now()

  // 静态资源直通：不经过任何 middleware 处理，避免 context.next() 包装导致 stream 断裂
  if (/\.(js|css|png|jpg|svg|ico|woff2?|ttf|webp|json|xml|txt)$/.test(path)) {
    return context.next()
  }

  const origin = request.headers.get('Origin')

  // 非受保护路径直接走原逻辑
  if (!needsCORS(path)) {
    return withSecurityHeaders(await context.next())
  }

  // OPTIONS 预检：白名单校验通过则放行，否则 403
  if (request.method === 'OPTIONS') {
    return handleCORSPreflight(origin)
  }

  const response = await context.next()

  // 失败请求统一落库（异步，不阻塞响应；内部已吞掉所有异常）
  if (shouldLogError(path, response.status)) {
    const task = captureApiError(context, response, path, startedAt)
    if (typeof context.waitUntil === 'function') {
      context.waitUntil(task)
    } else {
      // 本地 wrangler 某些版本无 waitUntil，兜底静默处理
      task.catch(() => {})
    }
  }

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