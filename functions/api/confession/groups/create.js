/**
 * 创建告白墙分组（仅管理员）
 *
 * POST /api/confession/groups/create
 * Headers: Authorization: Bearer <JWT>
 * Body: { name, icon?, color?, description? }
 *
 * 管理员判断：解析 JWT 拿 uid，再查 D1 `user.is_admin = 1`
 *            （复用 functions/api/_lib/model-resolver.js 的 isAdmin()）
 *
 * 写入：使用 SUPABASE_SERVICE_KEY 调用 Supabase REST API 插入 confession_groups
 */
import { extractUidFromRequest, isAdmin } from '../../_lib/model-resolver.js'

const corsHeaders = {

  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  // 1. 鉴权：解析 JWT 拿 uid
  const uid = await extractUidFromRequest(request, env)
  if (!uid) {
    return json({ ok: false, error: '未登录或登录已过期' }, 401)
  }

  // 2. 管理员校验
  const db = env.DB
  if (!db) {
    return json({ ok: false, error: '服务器配置错误（D1 未绑定）' }, 500)
  }
  const admin = await isAdmin(db, uid)
  if (!admin) {
    return json({ ok: false, error: '仅管理员可创建分组' }, 403)
  }

  // 3. 参数解析
  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: '无效的 JSON 请求体' }, 400)
  }
  const { name, icon, color, description } = body
  if (!name || typeof name !== 'string' || !name.trim()) {
    return json({ ok: false, error: '分组名不能为空' }, 400)
  }
  if (name.length > 20) {
    return json({ ok: false, error: '分组名最长 20 字' }, 400)
  }

  // 4. 写 Supabase（用 service role key 绕过 RLS）
  const supabaseUrl = env.SUPABASE_URL || ''
  const supabaseKey = env.SUPABASE_SERVICE_KEY || ''
  if (!supabaseUrl || !supabaseKey) {
    return json({ ok: false, error: '服务器配置错误（Supabase 环境变量缺失）' }, 500)
  }

  // 生成 slug
  const slug =
    'g-' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)

  const insertPayload = {
    name: name.trim(),
    slug,
    icon: icon || '📝',
    color: color || '#FFE4E1',
    description: description || '',
    sort_order: 99,
    is_default: false,
  }

  const resp = await fetch(`${supabaseUrl}/rest/v1/confession_groups`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(insertPayload),
  })

  if (!resp.ok) {
    const text = await resp.text()
    console.error('Supabase insert failed:', resp.status, text)
    // 23505 = unique violation (slug 重名)
    if (resp.status === 409 || text.includes('23505')) {
      return json({ ok: false, error: '分组 slug 冲突，请重试' }, 409)
    }
    return json({ ok: false, error: `创建失败: ${text}` }, 500)
  }

  const data = await resp.json()
  const group = Array.isArray(data) ? data[0] : data

  return json({ ok: true, group }, 200)
}