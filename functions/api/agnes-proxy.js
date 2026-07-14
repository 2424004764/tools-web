// 允许的 agnes-ai.com 接口白名单
// 注意：此端点为遗留过渡期接口，新代码请走 /api/ai-proxy（统一入口，model_key → endpoint 已在 D1 配置）
// 当前 src/ 中无任何调用方，仅保留以兼容潜在的旧集成。
const ALLOWED_ENDPOINTS = new Set([
  'text/chat',
  'chat/completions',
  'images/generations',
  'images/edits',
  'video/submit',
])
// endpoint 形态约束：仅允许小写字母开头、由字母数字/_/-/组成的相对路径，长度 ≤ 80
const ENDPOINT_PATTERN = /^[a-z][a-z0-9_\-/]{0,80}$/i

function isValidEndpoint(endpoint) {
  if (typeof endpoint !== 'string') return false
  if (!ENDPOINT_PATTERN.test(endpoint)) return false
  // 禁止路径穿越 / 协议注入（即便正则已限制，这里再防御一遍）
  if (endpoint.includes('..') || endpoint.includes('://') || endpoint.startsWith('/')) return false
  return ALLOWED_ENDPOINTS.has(endpoint)
}

export async function onRequest(context) {
  const { request } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {

        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json'}
    })
  }

  try {
    const body = await request.json()
    const { endpoint, ...data } = body

    // 白名单校验：防止 SSRF（攻击者通过 endpoint 探测内网或外部任意主机）
    if (!isValidEndpoint(endpoint)) {
      return new Response(JSON.stringify({
        error: 'endpoint 不在白名单或格式非法',
        allowed: Array.from(ALLOWED_ENDPOINTS) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json'}
      })
    }

    const agnesUrl = `https://agnes-ai.com/api/v1/${endpoint}`
    const authHeader = request.headers.get('Authorization')

    const response = await fetch(agnesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || ''
      },
      body: JSON.stringify(data)
    })

    const result = await response.json()

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json'}
    })
  }
}
