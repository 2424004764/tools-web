/**
 * Supabase 同源透明代理
 *
 * 背景：聊天室/表白墙/五子棋原先由前端持有 VITE_SUPABASE_URL + anon key 直连
 * Supabase（REST + Realtime WebSocket），密钥暴露在 bundle 里且可绕过站点直接
 * 读写数据库（聊天相关表未启用 RLS）。现在前端 supabase-js 的 baseURL 指向
 * 同源 /sb，全部流量经本 Function 转发，真实 URL 与密钥只存在于服务端环境变量。
 *
 * 路由约定（需与 functions/_routes.json 的 include、vite dev proxy 保持一致）：
 *   /sb/rest/v1/<table>          → PostgREST 白名单代理
 *   /sb/realtime/v1/websocket    → Realtime WebSocket 双向中继
 *
 * 环境变量（与 cron/clean-chat.js 共用）：
 *   - SUPABASE_URL          如 https://xxx.supabase.co
 *   - SUPABASE_SERVICE_KEY  service_role key（表 × 方法白名单是唯一访问控制）
 *
 * 安全设计：
 *   1. REST 按「表 × 方法」白名单放行，白名单严格等于前端四个 db 模块的实际用法
 *      （chatDb / gomokuDb / confessionDb），其余表与 rpc 一律 403；
 *   2. 写操作按 IP 限流（KV，复用 utils/rate-limit.js）；
 *   3. WebSocket 中继拦截客户端 phx_join 帧里的 postgres_changes 订阅，
 *      防止借中继订阅 user 等白名单外任意表（broadcast/presence 不暴露库表，放行）。
 */

import { getClientIp, hitLimit } from '../utils/rate-limit.js'

// 前端实际使用的表 → 允许的 HTTP 方法（PostgREST：GET/HEAD 查询、POST 插入、PATCH 更新、DELETE 删除）。
// 维护原则：前端 db 模块新增用法时同步补这里；没列出的默认拒绝。
const REST_TABLE_METHODS = {
  chat_messages: ['GET', 'HEAD', 'POST', 'PATCH'],
  chat_rooms: ['GET', 'HEAD', 'POST', 'PATCH'],
  gomoku_games: ['GET', 'HEAD', 'POST', 'PATCH'],
  gomoku_undo_requests: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
  confession_groups: ['GET', 'HEAD'],
  confession_messages: ['GET', 'HEAD', 'POST', 'PATCH'],
  confession_reactions: ['GET', 'HEAD', 'POST', 'DELETE'],
}

// Realtime postgres_changes 允许订阅的表（与 REST 白名单的表集合一致）
const REALTIME_TABLES = new Set(Object.keys(REST_TABLE_METHODS))

// 写操作限流：每 IP 每分钟。五子棋每次落子都会 update 一次棋盘，
// 阈值取宽松值，仅拦截脚本化灌水。
const WRITE_LIMIT = 120
const WRITE_WINDOW_SEC = 60

// 透传给上游的请求头白名单（其余一律丢弃，密钥由服务端注入）
const FORWARD_HEADERS = ['accept', 'content-type', 'prefer', 'range', 'accept-profile', 'content-profile']

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

// ============ REST 代理 ============

async function handleRest(request, env, url) {
  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '')
  const serviceKey = env.SUPABASE_SERVICE_KEY || ''
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Supabase 代理未配置' }, 500)
  }

  // 仅接受 /sb/rest/v1/<table> 单段表名；rpc 与多段路径一律拒绝
  const match = /^v1\/([a-zA-Z0-9_]+)$/.exec(url.pathname.slice('/sb/rest/'.length))
  if (!match) {
    return json({ error: '不支持的代理路径' }, 403)
  }
  const table = match[1]
  const allowedMethods = REST_TABLE_METHODS[table]
  if (!allowedMethods || !allowedMethods.includes(request.method)) {
    return json({ error: '不支持的表或方法' }, 403)
  }

  // 写操作按 IP 限流（KV 绑定缺失时跳过，不阻断正常使用）
  if (['POST', 'PATCH', 'DELETE'].includes(request.method)) {
    const ip = getClientIp(request)
    if (ip && env.VERIFICATION_CODES) {
      const r = await hitLimit(env.VERIFICATION_CODES, `rl:sbw:${ip}`, WRITE_LIMIT, WRITE_WINDOW_SEC)
      if (!r.allowed) {
        return json({ error: '操作过于频繁，请稍后再试' }, 429)
      }
    }
  }

  const headers = new Headers()
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  // 客户端携带的 apikey / Authorization 一律丢弃，注入服务端持有的 service key
  headers.set('apikey', serviceKey)
  headers.set('Authorization', `Bearer ${serviceKey}`)

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  // 聊天/表白/棋盘的写载体都是小 JSON，读满缓冲再转发，避免流式 body 的兼容性问题
  const body = hasBody ? await request.arrayBuffer() : undefined

  try {
    // 响应流式透传（全局 _middleware 会对非 101 响应补安全头）
    return await fetch(`${supabaseUrl}/rest/v1/${table}${url.search}`, {
      method: request.method,
      headers,
      body,
    })
  } catch (e) {
    console.error('[sb-proxy] rest upstream failed:', e)
    return json({ error: '聊天服务暂不可用' }, 502)
  }
}

// ============ Realtime WebSocket 中继 ============

// 检查客户端 phx_join 帧里的 postgres_changes 订阅是否在白名单内。
// 返回 null 表示放行原帧；返回字符串表示要回给客户端的错误 reply（并拦截原帧）。
// 非 JSON 帧（理论上是攻击载荷或协议损坏）原样放行——上游 Realtime 会自行拒绝，
// 我们无法解析的帧也不可能解析出合法订阅。
function inspectClientFrame(data) {
  let msg
  try {
    msg = JSON.parse(data)
  } catch {
    return null
  }
  if (!msg || typeof msg !== 'object' || msg.event !== 'phx_join') return null

  const changes = msg.payload && typeof msg.payload === 'object' ? msg.payload.config?.postgres_changes : null
  if (!Array.isArray(changes)) return null // broadcast / presence 频道，不涉及库表

  for (const item of changes) {
    const table = item && typeof item === 'object' ? item.table : null
    if (!table || !REALTIME_TABLES.has(table)) {
      return JSON.stringify({
        topic: msg.topic,
        ref: msg.ref ?? null,
        event: 'phx_reply',
        payload: { status: 'error', response: { reason: 'subscription not allowed' } },
      })
    }
  }
  return null
}

function handleRealtime(request, env) {
  if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
    return json({ error: 'WebSocket 升级请求无效' }, 426)
  }

  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '')
  const serviceKey = env.SUPABASE_SERVICE_KEY || ''
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Supabase 代理未配置' }, 500)
  }

  // 重建上游 WS 地址：丢弃客户端 apikey，注入服务端密钥，其余查询参数原样保留
  const inUrl = new URL(request.url)
  const upstreamUrl = new URL(`${supabaseUrl.replace(/^http/, 'ws')}/realtime/v1/websocket`)
  upstreamUrl.searchParams.set('vsn', inUrl.searchParams.get('vsn') || '1.0.0')
  upstreamUrl.searchParams.set('apikey', serviceKey)
  for (const [key, value] of inUrl.searchParams) {
    if (key !== 'apikey' && key !== 'vsn') upstreamUrl.searchParams.set(key, value)
  }

  // 先发起上游连接再 accept 客户端：构造失败时直接回 502，避免升级后再收线
  let upstream
  try {
    upstream = new WebSocket(upstreamUrl.toString())
  } catch (e) {
    console.error('[sb-proxy] realtime upstream connect failed:', e)
    return json({ error: '聊天服务暂不可用' }, 502)
  }

  const pair = new WebSocketPair()
  const client = pair[0]
  const server = pair[1]
  server.accept()

  // 上游就绪前到达的客户端帧排队转发（supabase-js 在 WS open 后立即发 phx_join，
  // 而此时上游 WebSocket 可能仍在 CONNECTING）
  const pending = []
  const MAX_PENDING = 64

  server.addEventListener('message', (event) => {
    const data = event.data
    if (typeof data === 'string') {
      const denial = inspectClientFrame(data)
      if (denial) {
        try { server.send(denial) } catch { /* ignore */ }
        return
      }
    }
    if (upstream.readyState === 1) {
      try { upstream.send(data) } catch { /* ignore */ }
    } else if (pending.length < MAX_PENDING) {
      pending.push(data)
    }
  })

  upstream.addEventListener('open', () => {
    while (pending.length > 0) {
      try { upstream.send(pending.shift()) } catch { /* ignore */ }
    }
  })
  upstream.addEventListener('message', (event) => {
    try { server.send(event.data) } catch { /* ignore */ }
  })
  upstream.addEventListener('close', (event) => {
    try { server.close(event.code || 1000, event.reason || '') } catch { /* ignore */ }
  })
  upstream.addEventListener('error', () => {
    try { server.close(1011, 'upstream error') } catch { /* ignore */ }
  })
  server.addEventListener('close', () => {
    try { upstream.close() } catch { /* ignore */ }
  })

  // 上游 15s 未完成握手则收线，避免空转连接堆积
  const openTimer = setTimeout(() => {
    if (upstream.readyState !== 1) {
      try { upstream.close() } catch { /* ignore */ }
      try { server.close(1011, 'upstream timeout') } catch { /* ignore */ }
    }
  }, 15000)
  upstream.addEventListener('open', () => clearTimeout(openTimer), { once: true })

  // 返回 client 端给网络侧；server 端已 accept 用于本端事件处理
  return new Response(null, { status: 101, webSocket: client })
}

// ============ 入口 ============

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  }

  if (url.pathname.startsWith('/sb/realtime/')) {
    return handleRealtime(request, env)
  }
  if (url.pathname.startsWith('/sb/rest/')) {
    return handleRest(request, env, url)
  }
  return json({ error: 'Not Found' }, 404)
}
