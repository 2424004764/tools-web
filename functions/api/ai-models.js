// AI 模型 CRUD API
// GET    /api/ai-models                       获取可见模型列表（管理员公开 + 自己的）
// GET    /api/ai-models?provider_id=xxx       按厂商过滤
// GET    /api/ai-models?model_key=xxx        按 model_key 精确查询
// GET    /api/ai-models?capability=chat       按能力过滤
// POST   /api/ai-models                       body: { provider_id, name, model_key, model_id, capabilities, endpoints, input_template, output_paths, is_public, ... }
// PUT    /api/ai-models?id=xxx                更新（管理员可改任何；用户只能改自己的 uid=自己 的）
// DELETE /api/ai-models?id=xxx                删除（管理员可删任何；用户只能删自己的）
//
// 字段可见性：
//   管理员：所有字段（含 base_url / api_key / 完整 input_template）
//   普通用户看自己的模型：完整字段
//   普通用户看管理员公开模型：api_key / base_url 被剥离（仅供调用 ai-proxy 即可）

import {
  extractUidFromRequest,
  isAdmin,
  buildModelVisibilityClause,
  buildProviderVisibilityClause,
} from './_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// 普通用户查看管理员公开模型时，需要剥掉的敏感字段
const STRIPPED_FIELDS_FOR_NON_OWNER = ['base_url', 'api_key']

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env.DB
  const url = new URL(request.url)
  const uid = extractUidFromRequest(request)
  const isAdminUser = await isAdmin(db, uid)

  try {
    // GET 列表/详情
    if (request.method === 'GET') {
      const id = url.searchParams.get('id')
      const providerId = url.searchParams.get('provider_id')
      const modelKey = url.searchParams.get('model_key')

      const vis = buildModelVisibilityClause(uid, isAdminUser)

      // 单个详情
      if (id || modelKey) {
        const keyClause = id ? 'm.id = ?' : 'm.model_key = ?'
        const keyVal = id || modelKey

        const result = await db.prepare(`
          SELECT m.*, p.slug AS provider_slug, p.name AS provider_name, p.base_url, p.api_key, p.is_public AS provider_is_public
          FROM ai_models m
          INNER JOIN ai_providers p ON p.id = m.provider_id
          WHERE ${keyClause} AND ${vis.sql}
        `).bind(keyVal, ...vis.args).first()

        if (!result) {
          return json({ success: false, error: '模型不存在或无权访问' }, 404)
        }

        const ownerUid = result.uid || ''
        const data = stripSensitive(result, { isAdminUser, viewerUid: uid, ownerUid })
        return json({ success: true, data })
      }

      // 列表（支持过滤）
      let sql = `
        SELECT m.id, m.uid, m.provider_id, m.name, m.model_key, m.model_id,
               m.capabilities, m.endpoints, m.input_template, m.output_paths,
               m.is_public, m.description, m.icon, m.sort_order, m.status,
               m.create_time, m.update_time,
               p.slug AS provider_slug, p.name AS provider_name, p.base_url, p.api_key,
               p.is_public AS provider_is_public
        FROM ai_models m
        INNER JOIN ai_providers p ON p.id = m.provider_id
        WHERE ${vis.sql}
      `
      const args = [...vis.args]

      if (providerId) {
        sql += ` AND m.provider_id = ?`
        args.push(providerId)
      }

      sql += ` ORDER BY p.is_public DESC, m.sort_order ASC, m.id ASC`

      const result = await db.prepare(sql).bind(...args).all()
      const data = (result.results || []).map(row =>
        stripSensitive(row, { isAdminUser, viewerUid: uid, ownerUid: row.uid || '' })
      )
      return json({ success: true, data })
    }

    // POST 创建
    if (request.method === 'POST') {
      if (!uid) return json({ success: false, error: '请先登录' }, 401)

      const body = await request.json().catch(() => ({}))
      const {
        provider_id, name, model_key, model_id,
        capabilities, endpoints, input_template, output_paths,
        is_public = 0,
        description = '', icon = '', sort_order = 0, status = 1
      } = body

      if (!provider_id || !name || !model_key || !model_id) {
        return json({ success: false, error: 'provider_id、name、model_key、model_id 必填' }, 400)
      }
      if (!capabilities || !endpoints || !input_template || !output_paths) {
        return json({ success: false, error: 'capabilities、endpoints、input_template、output_paths 必填' }, 400)
      }

      // 校验 provider 所有权：仅管理员或在私有厂商下能建
      const provider = await db.prepare(`
        SELECT id, uid, is_public FROM ai_providers WHERE id = ? AND status = 1
      `).bind(provider_id).first()
      if (!provider) {
        return json({ success: false, error: '厂商不存在' }, 404)
      }
      if (!provider.is_public && provider.uid !== uid) {
        return json({ success: false, error: '不能在其他用户的私有厂商下创建模型' }, 403)
      }

      // 普通用户不能把模型设为对外公开（uid 也不允许是 ''）
      if (!isAdminUser && is_public) {
        return json({ success: false, error: '只有管理员可以发布公开模型' }, 403)
      }

      // 校验 model_key 唯一性
      const existing = await db.prepare(`
        SELECT id FROM ai_models WHERE model_key = ?
      `).bind(model_key).first()
      if (existing) {
        return json({ success: false, error: '该 model_key 已存在，请使用唯一标识' }, 400)
      }

      const ownerUid = isAdminUser && is_public ? '' : uid
      const result = await db.prepare(`
        INSERT INTO ai_models (uid, provider_id, name, model_key, model_id,
          capabilities, endpoints, input_template, output_paths,
          is_public, description, icon, sort_order, status, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(ownerUid, provider_id, name, model_key, model_id,
              JSON.stringify(capabilities), JSON.stringify(endpoints),
              JSON.stringify(input_template), JSON.stringify(output_paths),
              is_public ? 1 : 0, description, icon, sort_order, status).run()

      return json({ success: true, data: { id: result.meta.last_row_id } })
    }

    // PUT 更新
    if (request.method === 'PUT') {
      if (!uid) return json({ success: false, error: '请先登录' }, 401)
      const id = url.searchParams.get('id')
      if (!id) return json({ success: false, error: '缺少 id' }, 400)

      const existing = await db.prepare(`
        SELECT m.id, m.uid, m.provider_id, p.uid AS provider_uid, p.is_public AS provider_is_public
        FROM ai_models m
        INNER JOIN ai_providers p ON p.id = m.provider_id
        WHERE m.id = ?
      `).bind(id).first()
      if (!existing) return json({ success: false, error: '模型不存在' }, 404)

      // 权限：管理员可改任何；普通用户只能改自己 uid=自己 的（且不能改 is_public=true）
      const isOwner = existing.uid === uid
      if (!isAdminUser && !isOwner) {
        return json({ success: false, error: '无权编辑此模型' }, 403)
      }

      const body = await request.json().catch(() => ({}))
      const sets = []
      const args = []
      const jsonFields = ['capabilities', 'endpoints', 'input_template', 'output_paths']

      for (const field of ['name', 'model_id', 'description', 'icon', 'sort_order', 'status']) {
        if (body[field] !== undefined) {
          sets.push(`${field} = ?`)
          args.push(body[field])
        }
      }
      for (const field of jsonFields) {
        if (body[field] !== undefined) {
          sets.push(`${field} = ?`)
          args.push(JSON.stringify(body[field]))
        }
      }
      if (body.is_public !== undefined) {
        if (!isAdminUser) {
          return json({ success: false, error: '只有管理员可以修改公开状态' }, 403)
        }
        sets.push('is_public = ?')
        args.push(body.is_public ? 1 : 0)
      }

      if (sets.length === 0) {
        return json({ success: false, error: '没有要更新的字段' }, 400)
      }
      sets.push('update_time = datetime(\'now\')')
      args.push(id)

      await db.prepare(`
        UPDATE ai_models SET ${sets.join(', ')} WHERE id = ?
      `).bind(...args).run()

      return json({ success: true })
    }

    // DELETE 删除
    if (request.method === 'DELETE') {
      if (!uid) return json({ success: false, error: '请先登录' }, 401)
      const id = url.searchParams.get('id')
      if (!id) return json({ success: false, error: '缺少 id' }, 400)

      const existing = await db.prepare(`
        SELECT m.id, m.uid, p.is_public AS provider_is_public
        FROM ai_models m
        INNER JOIN ai_providers p ON p.id = m.provider_id
        WHERE m.id = ?
      `).bind(id).first()
      if (!existing) return json({ success: false, error: '模型不存在' }, 404)

      const isOwner = existing.uid === uid
      if (!isAdminUser && !isOwner) {
        return json({ success: false, error: '无权删除此模型' }, 403)
      }

      await db.prepare(`DELETE FROM ai_models WHERE id = ?`).bind(id).run()
      return json({ success: true })
    }

    return json({ success: false, error: '不支持的请求方法' }, 405)
  } catch (error) {
    console.error('ai-models API error:', error)
    return json({ success: false, error: error.message || '服务器错误' }, 500)
  }
}

/**
 * 给普通用户剥掉敏感字段（admin 的公开模型）
 * - 管理员：返回所有字段
 * - owner 自己：返回所有字段
 * - 其他普通用户看 admin 公开模型：剥掉 base_url / api_key
 */
function stripSensitive(row, { isAdminUser, viewerUid, ownerUid }) {
  if (isAdminUser) return row
  if (ownerUid === viewerUid) return row // 自己的模型完整可见
  // 否则是普通用户看管理员的公开模型 → 剥敏感字段
  const stripped = { ...row }
  for (const f of STRIPPED_FIELDS_FOR_NON_OWNER) {
    if (f in stripped) {
      stripped[f] = f === 'api_key' ? '' : '***'
    }
  }
  return stripped
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}