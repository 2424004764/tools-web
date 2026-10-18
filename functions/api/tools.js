// 公开的工具列表 API（前台消费）
// GET /api/tools
// 返回启用的工具（is_enabled = 1），按分类 + 排序返回。
//
// 鉴权：不要求登录；用于替换前端硬编码的 tools.ts。
// 若 tool_features 表为空（未迁移），返回 { data: [], fallback: true }
// 前端 store 检测 fallback=true 时回退到 tools.ts。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    // 仅返回启用项；不在前台展示被禁用的工具。
    // 分类名称与排序以 tool_categories 表为准（LEFT JOIN 兜底未知分类）。
    const result = await db
      .prepare(
        `SELECT t.id, t.title, t.url, t.category_id,
                COALESCE(c.name, t.category_name, '其他') AS category_name,
                t.description, t.logo, t.sort_order
         FROM tool_features t
         LEFT JOIN tool_categories c ON c.id = t.category_id
         WHERE t.is_enabled = 1
           AND COALESCE(c.is_enabled, 1) = 1
         ORDER BY COALESCE(c.sort_order, 9999) ASC, t.category_id ASC, t.sort_order ASC, t.id ASC`,
      )
      .all()

    const rows = result.results || []
    // 若表完全为空（迁移未跑），返回 fallback 标志
    if (rows.length === 0) {
      return json({ data: [], categories: [], fallback: true })
    }

    // 同时组装按分类折叠的视图，便于前端 Left.vue / Home.vue 渲染
    const catMap = new Map()
    for (const row of rows) {
      const catKey = row.category_id
      if (!catMap.has(catKey)) {
        catMap.set(catKey, {
          id: row.category_id,
          title: row.category_name,
          list: [],
        })
      }
      catMap.get(catKey).list.push({
        id: row.id,
        title: row.title,
        logo: row.logo,
        desc: row.description,
        url: row.url,
        cateId: row.category_id,
        cate: row.category_name,
      })
    }

    return json({
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        logo: r.logo,
        desc: r.description,
        url: r.url,
        cateId: r.category_id,
        cate: r.category_name,
      })),
      categories: Array.from(catMap.values()),
      fallback: false,
    })
  } catch (error) {
    console.error('public /api/tools error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}