// Admin 工具 model 列表 API
// GET  /api/admin/tool-models?toolUrl=/ai-image-edit/  列表
// POST /api/admin/tool-models                          创建
//
// upstreams 字段（可选）：有序上游链 [{provider, model_id, style}]，
// null / 空数组 = 未配置（端点回退 legacy bafang + env key）。
//
// 鉴权已在 _middleware.js 完成。

import { parseUpstreamsJson, validateUpstreamsForSave } from '../../_lib/image-upstream.js'

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
                  sort_order, is_enabled, is_default, upstreams, created_at, updated_at
           FROM tool_models
           WHERE tool_url = ?
           ORDER BY sort_order ASC, id ASC`,
        )
        .bind(toolUrl)
        .all()

      // upstreams 落库是 JSON 字符串，出参解析成数组（空/非法 → null = 未配置）
      const list = (result.results || []).map((r) => ({
        ...r,
        upstreams: parseUpstreamsJson(r.upstreams),
      }))
      return json({ list })
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

      // 上游链校验（null/未传 = 不配置；数组按链校验 provider 存在、model_id 格式、style 枚举）
      let upstreamsJson = null
      if (body.upstreams !== undefined && body.upstreams !== null) {
        const v = await validateUpstreamsForSave(db, body.upstreams)
        if (!v.ok) return jsonError(v.error, 400)
        upstreamsJson = v.value ? JSON.stringify(v.value) : null
      }

      // 唯一键预检：UNIQUE(tool_url, model_key)。直接让 D1 抛约束错误的话，
      // 前端只能看到裸的 SQLITE_CONSTRAINT 文案，对管理员不友好
      const dup = await db
        .prepare('SELECT id FROM tool_models WHERE tool_url = ? AND model_key = ?')
        .bind(toolUrl, modelKey)
        .first()
      if (dup) return jsonError('该 model_key 在此工具下已存在', 400)

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
              is_enabled, is_default, upstreams, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            toolUrl, modelKey, modelLabel, description, creditCost, sortOrder,
            isEnabled, makeDefault ? 1 : 0, upstreamsJson, now, now,
          ),
      )

      const results = await db.batch(stmts)
      const insertMeta = results[results.length - 1]?.meta || results[results.length - 1] || {}
      // D1 各运行时自增 ID 属性名不一：生产 meta.last_row_id，旧版 miniflare last_insert_rowid / lastInsertRowid
      const newId = insertMeta.last_row_id ?? insertMeta.last_insert_rowid ?? insertMeta.lastInsertRowid

      // 读回新行：优先自增 ID；拿不到时按唯一键 (tool_url, model_key) 反查兜底，
      // 避免把 undefined 传给 bind 触发 D1_TYPE_ERROR
      const row = newId
        ? await db
            .prepare(
              `SELECT id, tool_url, model_key, model_label, description, credit_cost,
                      sort_order, is_enabled, is_default, upstreams, created_at, updated_at
               FROM tool_models WHERE id = ?`,
            )
            .bind(newId)
            .first()
        : await db
            .prepare(
              `SELECT id, tool_url, model_key, model_label, description, credit_cost,
                      sort_order, is_enabled, is_default, upstreams, created_at, updated_at
               FROM tool_models WHERE tool_url = ? AND model_key = ?`,
            )
            .bind(toolUrl, modelKey)
            .first()

      return json({ ...row, upstreams: parseUpstreamsJson(row?.upstreams) }, 201)
    }

    return jsonError('不支持的请求方法', 405)
  } catch (error) {
    console.error('admin/tool-models error:', error)
    // 预检与 INSERT 之间并发撞唯一键（极小概率）也翻译成人话
    if (/UNIQUE constraint failed/i.test(String(error?.message || ''))) {
      return jsonError('该 model_key 在此工具下已存在', 400)
    }
    return jsonError(error.message || '服务器错误', 500)
  }
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}
