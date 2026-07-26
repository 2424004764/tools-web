// Admin 单个 tool_model 更新/删除 API
// PUT    /api/admin/tool-models/:id  更新（白名单字段：model_label, description, credit_cost, sort_order, is_enabled, is_default）
// DELETE /api/admin/tool-models/:id  删除
//
// 切 default：用事务把同 tool_url 下其它 default 清掉再 SET 本条。
//
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
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

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env.DB
  if (!db) return jsonError('数据库未配置', 500)

  const id = context.params?.id
  if (!id) return jsonError('缺少 id', 400)
  const modelId = parseInt(id, 10)
  if (!Number.isInteger(modelId)) return jsonError('id 必须是整数', 400)

  try {
    if (request.method === 'PUT') {
      const body = await request.json().catch(() => ({}))
      const cur = await db
        .prepare('SELECT id, tool_url FROM tool_models WHERE id = ?')
        .bind(modelId)
        .first()
      if (!cur) return jsonError('model 不存在', 404)

      const sets = []
      const args = []
      const wantsDefault = body.is_default === 1 || body.is_default === true
      const unsetDefault = body.is_default === 0 || body.is_default === false

      if (body.model_label !== undefined) {
        const s = String(body.model_label).trim().slice(0, 200)
        if (!s) return jsonError('model_label 不能为空', 400)
        sets.push('model_label = ?'); args.push(s)
      }
      if (body.description !== undefined) {
        sets.push('description = ?'); args.push(String(body.description).slice(0, 500))
      }
      if (body.credit_cost !== undefined) {
        const c = Number(body.credit_cost)
        if (!Number.isInteger(c) || c < 0 || c > 999999) {
          return jsonError('credit_cost 必须是 0~999999 的非负整数', 400)
        }
        sets.push('credit_cost = ?'); args.push(c)
      }
      if (body.sort_order !== undefined) {
        const n = parseInt(body.sort_order, 10)
        if (!Number.isInteger(n)) return jsonError('sort_order 必须是整数', 400)
        sets.push('sort_order = ?'); args.push(n)
      }
      if (body.is_enabled !== undefined) {
        sets.push('is_enabled = ?'); args.push(body.is_enabled === 1 || body.is_enabled === true ? 1 : 0)
      }
      if (wantsDefault) {
        sets.push('is_default = 1')
      } else if (unsetDefault) {
        sets.push('is_default = 0')
      }

      if (sets.length === 0) return jsonError('没有要更新的字段', 400)

      const now = nowSql()
      const stmts = []

      // 切 default 时先清掉同 tool_url 下其它 default
      if (wantsDefault) {
        stmts.push(
          db
            .prepare(
              `UPDATE tool_models SET is_default = 0, updated_at = ?
               WHERE tool_url = ? AND id != ? AND is_default = 1`,
            )
            .bind(now, cur.tool_url, modelId),
        )
      }

      sets.push('updated_at = ?'); args.push(now)
      stmts.push(
        db
          .prepare(`UPDATE tool_models SET ${sets.join(', ')} WHERE id = ?`)
          .bind(...args, modelId),
      )

      await db.batch(stmts)

      const row = await db
        .prepare(
          `SELECT id, tool_url, model_key, model_label, description, credit_cost,
                  sort_order, is_enabled, is_default, created_at, updated_at
           FROM tool_models WHERE id = ?`,
        )
        .bind(modelId)
        .first()

      return json(row)
    }

    if (request.method === 'DELETE') {
      // 删除前清掉 default 标记影响（避免悬空 default）
      const cur = await db
        .prepare('SELECT id, tool_url, is_default FROM tool_models WHERE id = ?')
        .bind(modelId)
        .first()
      if (!cur) return jsonError('model 不存在', 404)

      const result = await db
        .prepare('DELETE FROM tool_models WHERE id = ?')
        .bind(modelId)
        .run()

      // 若删的是 default，自动把同 tool_url 下 sort_order 最小的启用项设为 default
      if (cur.is_default === 1) {
        const fallback = await db
          .prepare(
            `SELECT id FROM tool_models
             WHERE tool_url = ? AND is_enabled = 1
             ORDER BY sort_order ASC, id ASC
             LIMIT 1`,
          )
          .bind(cur.tool_url)
          .first()
        if (fallback?.id) {
          await db
            .prepare('UPDATE tool_models SET is_default = 1, updated_at = ? WHERE id = ?')
            .bind(nowSql(), fallback.id)
            .run()
        }
      }

      const changes = result.meta?.changes ?? result.changes ?? 0
      return json({ id: modelId, deleted: changes })
    }

    return jsonError('不支持的请求方法', 405)
  } catch (error) {
    console.error('admin/tool-models/[id] error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
