// 用户端工具使用记录 API
//   POST /api/me/tool-usage
//     body: { tool_url, tool_title }
//     鉴权：可选（未登录也写入，uid 留空字符串占位，用于统计全量使用）
//     行为：best-effort 写入 tool_usage_records，失败仅 log 不影响业务
//
// 设计要点：
//   - 鉴权用 extractUserFromRequestOptional：登录拿到 uid；未登录 uid = ''
//   - POST 失败一律 console.warn + 200 返回，调用方无法感知也不应感知
//   - 不做后端去重：前端 30 秒 sessionStorage 已去重，保留真实进入次数便于后台分析
//
// 路由说明：本文件精确匹配 /api/me/tool-usage（POST）。
// 子路径 /api/me/tool-usage/recent 单独走 functions/api/me/tool-usage/recent.js，
// 这是 Cloudflare Pages Functions 的惯例（与 credits/transactions.js 一致），
// 也是 wrangler 校验 _routes.json 通配路径的硬性要求。

import { AuthMiddleware } from '../../middlewares/auth.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function jsonNoop() {
  // POST 接口在参数无效/无 DB 等场景下统一返回 noop，避免泄露内部逻辑
  return new Response(JSON.stringify({ success: true, data: { recorded: false } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

/**
 * 提取客户端 IP。
 * - CF-Connecting-IP：Cloudflare 透传的真实客户端 IP（首选，最可信）
 * - X-Forwarded-For：兜底（取最左 IP，多级代理链最左侧通常是真实客户端）
 * - 都没有则返回 ''（写入 ip 列存 NULL）
 */
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

/**
 * 从 Cloudflare Pages Functions 的 request.cf 提取地理位置信息。
 * CF 边缘节点已识别每个客户端 IP，免费且准确（无需第三方 API）。
 * 字段：
 *   - country：ISO 3166-1 alpha-2 国家代码，如 'CN' / 'US'
 *   - region：省/州（格式依国家略有差异）
 *   - city：城市名（英文/原文）
 *   - timezone：IANA 时区，如 'Asia/Shanghai'
 *   - colo：CF 接入点机场代码，如 'HKG' / 'LAX'
 * 非 CF 环境或 IP 不可识别时，字段可能缺失，落到 null。
 */
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
  const toolUrl = (body?.tool_url || '').toString().trim()
  const toolTitle = (body?.tool_title || '').toString().trim()
  if (!toolUrl || !toolTitle) return jsonNoop()
  // 工具 url 必须是站内路径（防御性，避免脏数据写入）
  if (!toolUrl.startsWith('/') || toolUrl.startsWith('//')) return jsonNoop()

  const db = env?.DB
  if (!db) return jsonNoop()

  // 登录用户填 uid；未登录 uid 留空字符串（保持写入 + 让后台能统计全量访问）
  let uid = ''
  try {
    const auth = await AuthMiddleware.extractUserFromRequestOptional(request, env)
    if (auth.success && auth.user?.id) uid = auth.user.id
  } catch {
    // 鉴权解析失败不影响主流程：当作未登录处理
  }

  // 提取客户端 IP：登录用户也存，便于后台审计；
  // 匿名用户的核心标识就是 IP（让"最近使用"等按 IP 聚合的功能也能用）
  const ip = getClientIp(request)

  // 地理位置（CF 边缘节点识别，免费；非 CF / 不可识别时各字段为 null）
  const geo = getGeo(request)

  try {
    await db
      .prepare(
        `INSERT INTO tool_usage_records
           (uid, tool_url, tool_title, used_at, ip, country, region, city, timezone, colo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        uid,
        toolUrl,
        toolTitle,
        Math.floor(Date.now() / 1000),
        ip || null,
        geo.country,
        geo.region,
        geo.city,
        geo.timezone,
        geo.colo,
      )
      .run()
    return new Response(
      JSON.stringify({ success: true, data: { recorded: true } }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    console.warn('[tool-usage] insert failed:', err?.message || err)
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