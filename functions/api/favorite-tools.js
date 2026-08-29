// 用户工具收藏 API
// GET    /api/favorite-tools          获取当前用户收藏的工具列表（tool_url，按收藏时间倒序）
// POST   /api/favorite-tools          body: { tool_url }
// DELETE /api/favorite-tools?tool_url=  取消收藏
//
// 工具是前端静态清单（tools.ts），不入库，所以只存 tool_url；
// 标题 / logo 由前端投影到 toolsStore.cates 上。
// 鉴权：与 favorite-apps 相同，HMAC 验签提取 uid，禁止伪造 token。
import { extractUidFromRequest } from './_lib/model-resolver.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// tool_url 基本形态校验：站内路径（/ 开头），长度上限防滥用
function isValidToolUrl(url) {
  return typeof url === 'string' && url.startsWith('/') && url.length <= 200
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const db = env.DB
  const url = new URL(request.url)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) {
    return new Response(JSON.stringify({
      success: false,
      error: '请先登录'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  try {
    // GET - 收藏的工具 url 列表（按收藏时间倒序，前端直接用于横滑条排序和星标状态）
    if (request.method === 'GET') {
      const result = await db.prepare(`
        SELECT tool_url FROM user_favorite_tools WHERE uid = ? ORDER BY create_time DESC
      `).bind(uid).all()
      return new Response(JSON.stringify({
        success: true,
        data: (result.results || []).map(r => r.tool_url)
      }), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
    }

    // POST - 收藏工具
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const toolUrl = body.tool_url

      if (!isValidToolUrl(toolUrl)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'tool_url 参数不合法'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        })
      }

      // UNIQUE(uid, tool_url) 去重：重复收藏视为成功（幂等）
      try {
        await db.prepare(`
          INSERT INTO user_favorite_tools (uid, tool_url) VALUES (?, ?)
        `).bind(uid, toolUrl).run()
      } catch (e) {
        if (String(e.message || '').includes('UNIQUE')) {
          return new Response(JSON.stringify({
            success: true,
            data: { tool_url: toolUrl, alreadyFavorited: true }
          }), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
        }
        throw e
      }

      return new Response(JSON.stringify({
        success: true,
        data: { tool_url: toolUrl }
      }), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
    }

    // DELETE - 取消收藏（幂等：不存在也返回成功）
    if (request.method === 'DELETE') {
      const toolUrl = url.searchParams.get('tool_url')

      if (!isValidToolUrl(toolUrl)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'tool_url 参数不合法'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        })
      }

      await db.prepare(`
        DELETE FROM user_favorite_tools WHERE uid = ? AND tool_url = ?
      `).bind(uid, toolUrl).run()

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }

    return new Response(JSON.stringify({
      success: false,
      error: '不支持的请求方法'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })

  } catch (error) {
    console.error('FavoriteTools API错误:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || '服务器错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }
}
