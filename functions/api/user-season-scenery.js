// 四季景色用户数据API
import { extractUidFromRequest } from './_lib/model-resolver.js'

export async function onRequest(context) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env.DB

  try {
    // GET - 获取用户的四季景色数据
    if (request.method === 'GET') {
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

      const result = await db.prepare(`
        SELECT data FROM user_season_scenery WHERE uid = ?
      `).bind(uid).first()

      // 如果没有记录，返回空数组
      const data = result ? JSON.parse(result.data) : []

      return new Response(JSON.stringify({
        success: true,
        data: data
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // POST - 保存用户的四季景色数据
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
      const { data } = body

      if (!data) {
        return new Response(JSON.stringify({
          success: false,
          error: '缺少数据'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }

      // 将数据转换为 JSON 字符串存储
      const dataStr = JSON.stringify(data)
      const now = new Date().toISOString()

      // 检查是否已存在
      const existing = await db.prepare(`
        SELECT id FROM user_season_scenery WHERE uid = ?
      `).bind(uid).first()

      if (existing) {
        // 更新
        await db.prepare(`
          UPDATE user_season_scenery
          SET data = ?, update_time = ?
          WHERE uid = ?
        `).bind(dataStr, now, uid).run()
      } else {
        // 插入 - 生成唯一ID
        const id = `season-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        await db.prepare(`
          INSERT INTO user_season_scenery (id, uid, data, create_time, update_time)
          VALUES (?, ?, ?, ?, ?)
        `).bind(id, uid, dataStr, now, now).run()
      }

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
    console.error('四季景色API错误:', error)
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
