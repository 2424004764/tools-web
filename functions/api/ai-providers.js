// AI 厂商 CRUD API
// GET    /api/ai-providers              获取可见厂商列表（公开+自己的）
// GET    /api/ai-providers?id=xxx       获取单个厂商详情
// POST   /api/ai-providers              body: { name, slug, base_url, api_key, is_public, ... }
// PUT    /api/ai-providers?id=xxx       更新（管理员可改任何；用户只能改自己的）
// DELETE /api/ai-providers?id=xxx       删除（管理员可删任何；用户只能删自己的）
//
// 字段可见性：
//   管理员：所有字段
//   owner：所有字段
//   其他普通用户看公开厂商：api_key 剥掉、base_url 替换为占位

import {
  extractUidFromRequest,
  isAdmin,
  buildProviderVisibilityClause,
} from './_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

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
    // GET 列表
    if (request.method === 'GET') {
      const id = url.searchParams.get('id')
      const vis = buildProviderVisibilityClause(uid, isAdminUser)

      if (id) {
        const result = await db.prepare(`
          SELECT id, uid, name, slug, base_url, api_key, is_public, is_open, description, icon,
                 sort_order, status, create_time, update_time
          FROM ai_providers
          WHERE id = ? AND ${vis.sql}
        `).bind(id, ...vis.args).first()

        if (!result) {
          return json({ success: false, error: '厂商不存在或无权访问' }, 404)
        }
        const data = stripSensitive(result, { isAdminUser, viewerUid: uid, ownerUid: result.uid || '' })
        return json({ success: true, data })
      }

      const result = await db.prepare(`
        SELECT id, uid, name, slug, base_url, is_public, is_open, description, icon,
               sort_order, status, create_time, update_time
        FROM ai_providers
        WHERE ${vis.sql}
        ORDER BY is_public DESC, sort_order ASC, id ASC
      `).bind(...vis.args).all()

      // 普通用户看公开厂商：api_key 已经在 SELECT 里没选
      return json({ success: true, data: result.results || [] })
    }

    // POST 创建（必须登录）
    if (request.method === 'POST') {
      if (!uid) return json({ success: false, error: '请先登录' }, 401)
      const body = await request.json().catch(() => ({}))
      const { name, slug, base_url, api_key = '', is_public = 0, is_open = 0, description = '', icon = '', sort_order = 0 } = body

      if (!name || !slug || !base_url) {
        return json({ success: false, error: 'name、slug、base_url 必填' }, 400)
      }
      if (!/^[a-z0-9_-]{1,50}$/i.test(slug)) {
        return json({ success: false, error: 'slug 只能包含字母、数字、下划线、连字符' }, 400)
      }

      // 普通用户不能创建 is_public=1 或 is_open=1 的"系统级"厂商
      if (!isAdminUser && (is_public || is_open)) {
        return json({ success: false, error: '只有管理员可以创建系统级公开/开放厂商' }, 403)
      }

      // 检查 slug 唯一性
      const existing = await db.prepare(`
        SELECT id FROM ai_providers WHERE slug = ? AND uid = ?
      `).bind(slug, isAdminUser && is_public ? '' : uid).first()
      if (existing) {
        return json({ success: false, error: '该 slug 已存在' }, 400)
      }

      const ownerUid = isAdminUser && is_public ? '' : uid
      const result = await db.prepare(`
        INSERT INTO ai_providers (uid, name, slug, base_url, api_key, is_public, is_open,
          description, icon, sort_order, status, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `).bind(ownerUid, name, slug, base_url, api_key, is_public ? 1 : 0, is_open ? 1 : 0,
              description, icon, sort_order).run()

      return json({ success: true, data: { id: result.meta.last_row_id } })
    }

    // PUT 更新
    if (request.method === 'PUT') {
      if (!uid) return json({ success: false, error: '请先登录' }, 401)
      const id = url.searchParams.get('id')
      if (!id) return json({ success: false, error: '缺少 id' }, 400)

      const existing = await db.prepare(`
        SELECT id, uid, is_public FROM ai_providers WHERE id = ?
      `).bind(id).first()
      if (!existing) return json({ success: false, error: '厂商不存在' }, 404)

      const isOwner = existing.uid === uid
      if (!isAdminUser && !isOwner) {
        return json({ success: false, error: '无权编辑此厂商' }, 403)
      }

      const body = await request.json().catch(() => ({}))
      const { name, base_url, api_key, is_public, is_open, description, icon, sort_order, status } = body

      // 普通用户改自己的也不能改 is_public / is_open（不能把自己的私有厂商转公开/开放）
      if ((body.is_public !== undefined || body.is_open !== undefined) && !isAdminUser) {
        return json({ success: false, error: '只有管理员可以修改公开/开放状态' }, 403)
      }

      const sets = []
      const args = []
      if (name !== undefined) { sets.push('name = ?'); args.push(name) }
      if (base_url !== undefined) { sets.push('base_url = ?'); args.push(base_url) }
      if (api_key !== undefined) { sets.push('api_key = ?'); args.push(api_key) }
      if (is_public !== undefined) {
        sets.push('is_public = ?'); args.push(is_public ? 1 : 0)
        if (is_public) { sets.push('uid = ?'); args.push('') }
      }
      if (is_open !== undefined) {
        sets.push('is_open = ?'); args.push(is_open ? 1 : 0)
      }
      if (description !== undefined) { sets.push('description = ?'); args.push(description) }
      if (icon !== undefined) { sets.push('icon = ?'); args.push(icon) }
      if (sort_order !== undefined) { sets.push('sort_order = ?'); args.push(sort_order) }
      if (status !== undefined) { sets.push('status = ?'); args.push(status) }

      if (sets.length === 0) {
        return json({ success: false, error: '没有要更新的字段' }, 400)
      }
      sets.push('update_time = datetime(\'now\')')
      args.push(id)

      await db.prepare(`
        UPDATE ai_providers SET ${sets.join(', ')} WHERE id = ?
      `).bind(...args).run()

      return json({ success: true })
    }

    // DELETE 删除
    if (request.method === 'DELETE') {
      if (!uid) return json({ success: false, error: '请先登录' }, 401)
      const id = url.searchParams.get('id')
      if (!id) return json({ success: false, error: '缺少 id' }, 400)

      const existing = await db.prepare(`
        SELECT id, uid, is_public FROM ai_providers WHERE id = ?
      `).bind(id).first()
      if (!existing) return json({ success: false, error: '厂商不存在' }, 404)

      const isOwner = existing.uid === uid
      if (!isAdminUser && !isOwner) {
        return json({ success: false, error: '无权删除此厂商' }, 403)
      }

      // 级联删除（ai_models 有外键 ON DELETE CASCADE）
      await db.prepare(`DELETE FROM ai_providers WHERE id = ?`).bind(id).run()
      return json({ success: true })
    }

    return json({ success: false, error: '不支持的请求方法' }, 405)
  } catch (error) {
    console.error('ai-providers API error:', error)
    return json({ success: false, error: error.message || '服务器错误' }, 500)
  }
}

/**
 * 普通用户看公开厂商的详情时，剥掉 api_key
 */
function stripSensitive(row, { isAdminUser, viewerUid, ownerUid }) {
  if (isAdminUser) return row
  if (ownerUid === viewerUid) return row
  if (row.api_key !== undefined) row.api_key = ''
  return row
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}