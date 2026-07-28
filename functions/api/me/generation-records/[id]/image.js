// 用户生成结果图片代理
// GET /api/me/generation-records/:id/image
//
// 为什么需要：result_url 来自第三方图床（img.pinest.xyz），不带 CORS 头，
// 浏览器 fetch 会跨域失败。后端 fetch 没有 CORS 限制，代理转发即可。
//
// 鉴权：必须登录，且该记录必须属于当前用户（避免 SSRF 风险）。
// 鉴权失败返 401/403，资源缺失返 404。

import { extractUidFromRequest } from '../../../_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return jsonError('请先登录', 401)

  const id = context.params?.id
  if (!id) return jsonError('缺少记录 id', 400)

  // 查记录：必须 uid 匹配 + status='success' + result_url 非空
  const row = await db
    .prepare(
      `SELECT result_url, status FROM generation_records WHERE id = ? AND uid = ?`,
    )
    .bind(id, uid)
    .first()

  if (!row) return jsonError('记录不存在或无权访问', 404)
  if (row.status !== 'success' || !row.result_url) {
    return jsonError('该记录无可下载的图片', 400)
  }

  // 服务端 fetch（无 CORS 限制），直接流式转发
  try {
    const upstream = await fetch(row.result_url)
    if (!upstream.ok) {
      return jsonError(`上游图床返回 ${upstream.status}`, 502)
    }
    const contentType = upstream.headers.get('Content-Type') || 'image/png'
    // 从 URL 或 Content-Type 推断文件后缀，给个默认文件名
    const ext = inferExt(row.result_url, contentType)
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // 提示浏览器下载，文件名由前端 autoDown 决定，这里给个 fallback
        'Content-Disposition': `inline; filename="ai-image.${ext}"`,
        // 缓存：图片生成后 URL 一般永久有效，给 1 天
        'Cache-Control': 'public, max-age=86400',
        ...corsHeaders,
      },
    })
  } catch (err) {
    console.error('[me/generation-records/[id]/image] upstream fetch failed', err)
    return jsonError('拉取图片失败：' + (err?.message || '网络异常'), 502)
  }
}

function inferExt(url, contentType) {
  // 优先从 URL 路径拿扩展名
  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()
    const m = path.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)(?:\?|$)/)
    if (m) return m[1] === 'jpeg' ? 'jpg' : m[1]
  } catch {
    /* ignore */
  }
  // 兜底用 Content-Type
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'png'
}