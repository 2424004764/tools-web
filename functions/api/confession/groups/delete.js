/**
 * 删除告白墙分组（仅管理员）
 *
 * DELETE /api/confession/groups/delete?id=<groupId>
 * Headers: Authorization: Bearer <JWT>
 *
 * 管理员判断：复用 functions/api/_lib/model-resolver.js 的 isAdmin()
 *
 * 删除行为：Supabase ON DELETE CASCADE 会自动级联删除该分组下的所有告白和反应
 *
 * ⚠️ 高危操作：会永久删除该分组下所有告白数据。请谨慎执行。
 */
import { extractUidFromRequest, isAdmin } from '../../_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
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

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'DELETE') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  // 1. 鉴权
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
    return json({ ok: false, error: '仅管理员可删除分组' }, 403)
  }

  // 3. 取 group_id
  const url = new URL(request.url)
  const groupId = url.searchParams.get('id')
  if (!groupId) {
    return json({ ok: false, error: '缺少分组 id 参数' }, 400)
  }
  // 简单 UUID 格式校验，防止 SQL 注入
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) {
    return json({ ok: false, error: '分组 id 格式错误' }, 400)
  }

  // 4. 写 Supabase
  const supabaseUrl = env.SUPABASE_URL || ''
  const supabaseKey = env.SUPABASE_SERVICE_KEY || ''
  if (!supabaseUrl || !supabaseKey) {
    return json({ ok: false, error: '服务器配置错误（Supabase 环境变量缺失）' }, 500)
  }

  // 先查询分组信息（返回给前端）
  const getResp = await fetch(
    `${supabaseUrl}/rest/v1/confession_groups?id=eq.${groupId}&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  )
  if (!getResp.ok) {
    return json({ ok: false, error: '查询分组失败' }, 500)
  }
  const groups = await getResp.json()
  if (!groups || groups.length === 0) {
    return json({ ok: false, error: '分组不存在' }, 404)
  }
  const group = groups[0]

  // 执行删除（ON DELETE CASCADE 会级联删除相关消息和反应）
  const delResp = await fetch(
    `${supabaseUrl}/rest/v1/confession_groups?id=eq.${groupId}`,
    {
      method: 'DELETE',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  )

  if (!delResp.ok) {
    const text = await delResp.text()
    console.error('Supabase delete failed:', delResp.status, text)
    return json({ ok: false, error: `删除失败: ${text}` }, 500)
  }

  return json({
    ok: true,
    deleted: { id: groupId, name: group.name },
    message: `已永久删除分组「${group.name}」及其下所有告白`,
  })
}