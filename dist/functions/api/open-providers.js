// 公开返回 is_open=1 的厂商列表（无需登录，给前端 Key 配置 UI 用）
// 字段：id, slug, name, icon, description
import { ApiResponse } from '../utils/db.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') {
    return json({ success: false, error: '仅支持 GET 请求' }, 405)
  }

  try {
    const result = await env.DB.prepare(`
      SELECT id, slug, name, icon, description
      FROM ai_providers
      WHERE status = 1 AND is_open = 1
      ORDER BY sort_order ASC, id ASC
    `).all()

    return json({ success: true, data: result.results || [] })
  } catch (error) {
    console.error('open-providers error:', error)
    return json({ success: false, error: '加载失败' }, 500)
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}