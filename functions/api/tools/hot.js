// 公开的工具热度列表 API（前台消费）
// GET /api/tools/hot
// 返回启用的工具（is_enabled = 1），与 /api/tools 同构（data + categories + fallback），
// 唯一区别：每个分类的 list 按 tool_usage_records 的累计使用次数降序排列。
//
// 关键约束：点击次数只用于服务端排序，不随响应返回（use_cnt 仅出现在 SQL 内部）。
// 前端「按使用热度排序」按钮直接消费本接口的返回顺序即可。
//
// 鉴权：不要求登录。未使用过的工具排在用过的后面，同分类内保持 sort_order 原序。

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
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    const result = await db
      .prepare(
        `SELECT f.id, f.title, f.url, f.category_id, f.category_name, f.description, f.logo, f.sort_order,
                COALESCE(u.cnt, 0) AS use_cnt
         FROM tool_features f
         LEFT JOIN (
             SELECT tool_url, COUNT(*) AS cnt
             FROM tool_usage_records
             GROUP BY tool_url
         ) u ON u.tool_url = f.url
         WHERE f.is_enabled = 1
         ORDER BY f.category_id ASC, use_cnt DESC, f.sort_order ASC, f.id ASC`,
      )
      .all()

    const rows = result.results || []
    if (rows.length === 0) {
      return json({ data: [], categories: [], fallback: true })
    }

    // SQL 已按 category_id + use_cnt 排好序，顺序遍历折叠即可保持各分类内热度序
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
    console.error('public /api/tools/hot error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
