// 获取AI应用列表
import { extractUidFromRequest } from './_lib/model-resolver.js'

export async function onRequest(context) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {

    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env.DB
  const url = new URL(request.url)

  try {
    // GET - 获取应用列表或单个应用详情
    if (request.method === 'GET') {
      const uid = (await extractUidFromRequest(request, env)) || null
      const appId = url.searchParams.get('id')

      // 获取单个应用详情
      if (appId) {
        if (!uid) {
          return new Response(JSON.stringify({
            success: false,
            error: '请先登录'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          })
        }

        const result = await db.prepare(`
          SELECT id, name, icon, title, description, category,
                 gradient_from, gradient_to, border_color, system_prompt
          FROM ai_apps
          WHERE id = ? AND uid = ? AND app_type = 'custom'
        `).bind(appId, uid).first()

        if (!result) {
          return new Response(JSON.stringify({
            success: false,
            error: '应用不存在或无权访问'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          })
        }

        return new Response(JSON.stringify({
          success: true,
          data: result
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }

      // 获取应用列表
      let query = `
        SELECT id, name, icon, title, description, category,
               gradient_from, gradient_to, border_color, sort_order, app_type, system_prompt
        FROM ai_apps
        WHERE status = 1 AND (app_type = 'system'
      `

      const params = []

      // 如果已登录，同时查询该用户的自建应用
      if (uid) {
        query += ` OR (app_type = 'custom' AND uid = ?)`
        params.push(uid)
      }

      query += `) ORDER BY app_type DESC, sort_order ASC`

      const result = await db.prepare(query).bind(...params).all()

      return new Response(JSON.stringify({
        success: true,
        data: result.results || []
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })
    }

    // POST - 创建自建应用（需要登录）
    if (request.method === 'POST') {
      const uid = await extractUidFromRequest(request, env)
      if (!uid) {
        return new Response(JSON.stringify({
          success: false,
          error: '请先登录'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }

      const body = await request.json()
      const { title, icon, description, category, system_prompt, gradient_from, gradient_to, border_color } = body

      // 生成ID
      const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const name = id

      await db.prepare(`
        INSERT INTO ai_apps (id, name, icon, title, description, category,
          gradient_from, gradient_to, border_color, sort_order, status,
          app_type, uid, system_prompt, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 'custom', ?, ?, datetime('now'), datetime('now'))
      `).bind(
        id, name, icon, title, description, category,
        gradient_from, gradient_to, border_color,
        uid,
        system_prompt || ''
      ).run()

      return new Response(JSON.stringify({
        success: true,
        data: { id, name }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // PUT - 更新自建应用（需要登录且是应用创建者）
    if (request.method === 'PUT') {
      const uid = await extractUidFromRequest(request, env)
      if (!uid) {
        return new Response(JSON.stringify({
          success: false,
          error: '请先登录'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }

      const appId = url.searchParams.get('id')
      if (!appId) {
        return new Response(JSON.stringify({
          success: false,
          error: '缺少应用ID'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }

      const body = await request.json()
      const { title, icon, description, category, system_prompt, gradient_from, gradient_to, border_color } = body

      // 更新应用（只能更新自己创建的）
      await db.prepare(`
        UPDATE ai_apps
        SET title = ?, icon = ?, description = ?, category = ?,
            gradient_from = ?, gradient_to = ?, border_color = ?,
            system_prompt = ?, update_time = datetime('now')
        WHERE id = ? AND uid = ? AND app_type = 'custom'
      `).bind(
        title, icon, description, category,
        gradient_from, gradient_to, border_color,
        system_prompt || '',
        appId, uid
      ).run()

      return new Response(JSON.stringify({
        success: true
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // DELETE - 删除自建应用（需要登录且是应用创建者）
    if (request.method === 'DELETE') {
      const uid = await extractUidFromRequest(request, env)
      if (!uid) {
        return new Response(JSON.stringify({
          success: false,
          error: '请先登录'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }

      const appId = url.searchParams.get('id')
      if (!appId) {
        return new Response(JSON.stringify({
          success: false,
          error: '缺少应用ID'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }

      // 只能删除自己创建的自建应用
      await db.prepare(`
        DELETE FROM ai_apps
        WHERE id = ? AND app_type = 'custom' AND uid = ?
      `).bind(appId, uid).run()

      return new Response(JSON.stringify({
        success: true
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    return new Response(JSON.stringify({
      success: false,
      error: '不支持的请求方法'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('AI应用API错误:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || '服务器错误'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  }
}
