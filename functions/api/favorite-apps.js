// 用户收藏AI应用 API
// GET    /api/favorite-apps          获取当前用户所有收藏（联表 ai_apps 返回完整应用信息）
// GET    /api/favorite-apps?ids=1    获取当前用户收藏的 app_id 列表（轻量，用于前端判断红心状态）
// POST   /api/favorite-apps          body: { app_id }
// DELETE /api/favorite-apps?app_id=  删除收藏
export async function onRequest(context) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env.DB
  const url = new URL(request.url)

  // 从 JWT token 中提取用户信息
  const getUserFromToken = async () => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }
    const token = authHeader.substring(7)
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload.exp && payload.exp * 1000 <= Date.now()) return null
      return payload
    } catch (e) {
      return null
    }
  }

  const user = await getUserFromToken()
  if (!user || !user.uid) {
    return new Response(JSON.stringify({
      success: false,
      error: '请先登录'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
  const uid = user.uid

  try {
    // GET - 获取收藏列表
    if (request.method === 'GET') {
      const idsOnly = url.searchParams.get('ids')

      // 轻量模式：仅返回收藏的 app_id 列表（用于前端判断红心状态）
      if (idsOnly === '1') {
        const result = await db.prepare(`
          SELECT app_id FROM user_favorite_apps WHERE uid = ?
        `).bind(uid).all()
        return new Response(JSON.stringify({
          success: true,
          data: (result.results || []).map(r => r.app_id)
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
      }

      // 完整模式：联表 ai_apps 返回完整应用信息
      const result = await db.prepare(`
        SELECT
          fav.id AS favorite_id,
          fav.app_id,
          fav.app_type,
          fav.create_time AS favorite_time,
          app.name,
          app.icon,
          app.title,
          app.description,
          app.category,
          app.gradient_from,
          app.gradient_to,
          app.border_color,
          app.sort_order,
          app.system_prompt
        FROM user_favorite_apps fav
        INNER JOIN ai_apps app ON app.id = fav.app_id
        WHERE fav.uid = ?
        ORDER BY fav.create_time DESC
      `).bind(uid).all()

      return new Response(JSON.stringify({
        success: true,
        data: result.results || []
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    // POST - 收藏应用
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const appId = body.app_id

      if (!appId || typeof appId !== 'string') {
        return new Response(JSON.stringify({
          success: false,
          error: '缺少 app_id 参数'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }

      // 校验应用存在，并获取 app_type
      const app = await db.prepare(`
        SELECT id, app_type, status FROM ai_apps WHERE id = ?
      `).bind(appId).first()

      if (!app) {
        return new Response(JSON.stringify({
          success: false,
          error: '应用不存在'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }

      // 自建应用校验：必须是自己创建的
      if (app.app_type === 'custom') {
        const customApp = await db.prepare(`
          SELECT uid FROM ai_apps WHERE id = ? AND app_type = 'custom'
        `).bind(appId).first()
        if (!customApp || customApp.uid !== uid) {
          return new Response(JSON.stringify({
            success: false,
            error: '只能收藏自己创建的应用'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          })
        }
      }

      // 插入（依靠 UNIQUE(uid, app_id) 去重）
      try {
        await db.prepare(`
          INSERT INTO user_favorite_apps (uid, app_id, app_type, create_time)
          VALUES (?, ?, ?, datetime('now'))
        `).bind(uid, appId, app.app_type).run()
      } catch (e) {
        // UNIQUE 约束触发即视为已收藏
        if (String(e.message || '').includes('UNIQUE')) {
          return new Response(JSON.stringify({
            success: true,
            data: { app_id: appId, alreadyFavorited: true }
          }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
        }
        throw e
      }

      return new Response(JSON.stringify({
        success: true,
        data: { app_id: appId }
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    // DELETE - 取消收藏
    if (request.method === 'DELETE') {
      const appId = url.searchParams.get('app_id')

      if (!appId) {
        return new Response(JSON.stringify({
          success: false,
          error: '缺少 app_id 参数'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }

      await db.prepare(`
        DELETE FROM user_favorite_apps WHERE uid = ? AND app_id = ?
      `).bind(uid, appId).run()

      return new Response(JSON.stringify({
        success: true
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    return new Response(JSON.stringify({
      success: false,
      error: '不支持的请求方法'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('FavoriteApps API错误:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || '服务器错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
}