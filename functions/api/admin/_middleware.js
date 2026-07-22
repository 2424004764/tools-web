// Admin 后台 API 统一鉴权中间件
// 应用于 functions/api/admin/* 下所有端点
// 1. 校验 Bearer JWT
// 2. 检查 user.is_admin = 1
// 3. 将 adminUid 注入到 context.data 供下游 handler 使用
//
// 注意：Cloudflare Pages Functions 的 _middleware.js 通过 context.next() 传递；
// 若鉴权失败，必须直接返回 Response，不调用 next()。

import { extractUidFromRequest, isAdmin } from '../_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env, data } = context

  // OPTIONS 预检直接放行
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env?.DB
  if (!db) {
    return json({ success: false, error: '数据库未配置' }, 500)
  }

  // 提取 uid 并检查管理员权限
  const uid = await extractUidFromRequest(request, env)
  if (!uid) {
    return json({ success: false, error: '请先登录' }, 401)
  }

  const admin = await isAdmin(db, uid)
  if (!admin) {
    return json({ success: false, error: '无管理员权限' }, 403)
  }

  // 注入给下游 handler
  if (typeof data === 'object' && data !== null) {
    data.adminUid = uid
  } else {
    context.data = { adminUid: uid }
  }

  return context.next()
}