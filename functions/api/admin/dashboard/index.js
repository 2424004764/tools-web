// Admin 仪表盘统计 API（聚合全部面板，兼容旧前端）
// GET /api/admin/dashboard
//
// 各面板数据已拆分到 _data.js 的独立查询函数；
// 前端各卡片独立拉取请用 GET /api/admin/dashboard/:panel（见 ../[panel].js）。
//
// 中间件 _middleware.js 已确保调用方为管理员，无需再做权限检查。

import {
  getOverview,
  getStorage,
  getUserTrend,
  getUsage,
  getTopTools,
  getSlowQueries,
  getPending,
  getTransactions,
} from './_data.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  try {
    const [
      overview,
      storage,
      userTrend,
      usage,
      topTools,
      slowQueries,
      pending,
      transactions,
    ] = await Promise.all([
      getOverview(db),
      getStorage(db),
      getUserTrend(db),
      getUsage(db),
      getTopTools(db),
      getSlowQueries(db),
      getPending(db),
      getTransactions(db),
    ])

    return json({
      ...overview,
      ...storage,
      ...userTrend,
      ...usage,
      ...topTools,
      ...slowQueries,
      ...pending,
      recentTransactions: transactions.recentTransactions,
    })
  } catch (error) {
    console.error('dashboard API error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
