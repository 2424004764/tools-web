// 获取AI应用列表
export async function onRequest(context) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const db = env.DB

    // 查询所有上架的应用，按sort_order排序
    const result = await db.prepare(`
      SELECT id, name, icon, title, description, category,
             gradient_from, gradient_to, border_color, sort_order
      FROM ai_apps
      WHERE status = 1
      ORDER BY sort_order ASC
    `).all()

    return new Response(JSON.stringify({
      success: true,
      data: result.results || []
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  } catch (error) {
    console.error('获取AI应用列表失败:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || '获取应用列表失败'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  }
}
