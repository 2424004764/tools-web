// 用户端网站访问记录 API（站点级 PV 埋点）
//   POST /api/me/site-visit
//     body: { path, source? }
//     鉴权：可选（未登录也写入，uid 留空字符串，用于统计全量访问）
//     行为：best-effort 写入 site_visits，失败仅 log，始终 200 返回
//
// 设计要点：
//   - 与 /api/me/tool-usage 同款链路，但后端不做去重（业务要求重复刷新也算一次），
//     前端也不去重：每次路由成功导航都上报一条
//   - path 防御性过滤：必须是站内路径（/ 开头、非 //、非 /api 前缀、≤ 200 字符），
//     静态资源与接口请求不会经过 SPA 路由，天然不会上报
//
// 路由说明：本文件精确匹配 /api/me/site-visit（POST），
// 需在 functions/_routes.json 的 include 中注册。

import { AuthMiddleware } from '../../middlewares/auth.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function jsonNoop() {
  return new Response(JSON.stringify({ success: true, data: { recorded: false } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function getClientIp(request) {
  const cf = request.headers.get('CF-Connecting-IP')
  if (cf) return cf.trim()
  const xff = request.headers.get('X-Forwarded-For')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return ''
}

// 从 request.cf 提取地理位置（CF 边缘节点识别，免费；不可识别时为 null）
function getGeo(request) {
  const cf = request.cf || {}
  return {
    country: typeof cf.country === 'string' ? cf.country : null,
    region: typeof cf.region === 'string' ? cf.region : null,
    city: typeof cf.city === 'string' ? cf.city : null,
    timezone: typeof cf.timezone === 'string' ? cf.timezone : null,
    colo: typeof cf.colo === 'string' ? cf.colo : null,
  }
}

export async function onRequestPost(context) {
  const { request, env } = context

  let body
  try {
    body = await request.json()
  } catch {
    return jsonNoop()
  }
  const path = (body?.path || '').toString().trim()
  if (!path || path.length > 200) return jsonNoop()
  // 必须是站内路径（防御性，避免脏数据写入）
  if (!path.startsWith('/') || path.startsWith('//')) return jsonNoop()
  // 接口路径不走 SPA 路由，正常不该出现；万一前端有 bug 也不写库
  if (path.startsWith('/api/')) return jsonNoop()

  // 推广来源：前端 utils/source.ts 已规范化，这里再做一次防御性过滤
  const rawSource = (body?.source || '').toString()
  const source = rawSource
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64) || null

  const db = env?.DB
  if (!db) return jsonNoop()

  // 登录用户填 uid；未登录留空字符串（与 tool_usage_records 口径一致）
  let uid = ''
  try {
    const auth = await AuthMiddleware.extractUserFromRequestOptional(request, env)
    if (auth.success && auth.user?.id) uid = auth.user.id
  } catch {
    // 鉴权解析失败不影响主流程：当作未登录处理
  }

  const ip = getClientIp(request)
  const geo = getGeo(request)

  try {
    await db
      .prepare(
        `INSERT INTO site_visits
           (uid, path, visited_at, ip, country, region, city, timezone, colo, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        uid,
        path,
        Math.floor(Date.now() / 1000),
        ip || null,
        geo.country,
        geo.region,
        geo.city,
        geo.timezone,
        geo.colo,
        source,
      )
      .run()
    return new Response(
      JSON.stringify({ success: true, data: { recorded: true } }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    console.warn('[site-visit] insert failed:', err?.message || err)
    return jsonNoop()
  }
}

// 仅接受 POST，其他方法 405
export async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
  return onRequestPost(context)
}
