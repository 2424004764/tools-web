// Admin 工具 model 列表 API
// GET  /api/admin/tool-models?toolUrl=/ai-image-edit/  列表
// POST /api/admin/tool-models                          创建
//
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const toolUrl = (url.searchParams.get('toolUrl') || '').trim()
      if (!toolUrl) return jsonError('缺少 toolUrl 参数', 400)

      const result = await db
        .prepare(
          `SELECT id, tool_url, model_key, model_label, description, credit_cost,
                  sort_order, is_enabled, is_default, created_at, updated_at
           FROM tool_models
           WHERE tool_url = ?
           ORDER BY sort_order ASC, id ASC`,
        )
        .bind(toolUrl)
        .all()

      return json({ list: result.results || [] })
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const toolUrl = (body.tool_url || '').toString().trim()
      const modelKey = (body.model_key || '').toString().trim()
      const modelLabel = (body.model_label || '').toString().trim()
      const description = (body.description || '').toString().slice(0, 500)
      const creditCost = Number(body.credit_cost)
      const sortOrder = Number(body.sort_order) || 0
      const isEnabled = body.is_enabled === 0 || body.is_enabled === false ? 0 : 1
      const makeDefault = body.is_default === 1 || body.is_default === true

      if (!toolUrl) return jsonError('tool_url 必填', 400)
      if (!modelKey) return jsonError('model_key 必填', 400)
      if (!modelLabel) return jsonError('model_label 必填', 400)
      if (!Number.isInteger(creditCost) || creditCost < 0 || creditCost > 999999) {
        return jsonError('credit_cost 必须是 0~999999 的非负整数', 400)
      }
      if (modelKey.length > 100) return jsonError('model_key 长度不可超过 100', 400)
      if (modelLabel.length > 200) return jsonError('model_label 长度不可超过 200', 400)

      const now = nowSql()
      const stmts = []

      // 若 is_default=1，先把同 tool_url 下其它 default 清掉
      if (makeDefault) {
        stmts.push(
          db
            .prepare(
              `UPDATE tool_models SET is_default = 0, updated_at = ?
               WHERE tool_url = ? AND is_default = 1`,
            )
            .bind(now, toolUrl),
        )
      }

      stmts.push(
        db
          .prepare(
            `INSERT INTO tool_models
             (tool_url, model_key, model_label, description, credit_cost, sort_order,
              is_enabled, is_default, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            toolUrl, modelKey, modelLabel, description, creditCost, sortOrder,
            isEnabled, makeDefault ? 1 : 0, now, now,
          ),
      )

      const results = await db.batch(stmts)
      const insertMeta = results[results.length - 1]?.meta || results[results.length - 1] || {}
      const newId = insertMeta.last_insert_rowid || insertMeta.lastInsertRowid

      const row = await db
        .prepare(
          `SELECT id, tool_url, model_key, model_label, description, credit_cost,
                  sort_order, is_enabled, is_default, created_at, updated_at
           FROM tool_models WHERE id = ?`,
        )
        .bind(newId)
        .first()

      return json(row, 201)
    }

    return jsonError('不支持的请求方法', 405)
  } catch (error) {
    console.error('admin/tool-models error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}
