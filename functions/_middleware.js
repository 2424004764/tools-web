import { getCORSHeaders } from './utils/cors.js'

export function onRequest(context) {
  const { request } = context
  const origin = request.headers.get('Origin')
  const url = new URL(request.url)
  const path = url.pathname

  // 处理 API 路径的 OPTIONS 预检请求
  if (request.method === 'OPTIONS' && path.startsWith('/api/')) {
    return new Response(null, {
      status: 204,
      headers: getCORSHeaders(origin)
    })
  }

  // 继续处理其他请求
  return context.next()
}
