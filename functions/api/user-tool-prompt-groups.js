// 用户级提示词分组 API
// GET    /api/user-tool-prompt-groups?scene=ai-image-edit     列出当前用户在某 scene 下的所有分组
// POST   /api/user-tool-prompt-groups                          body: { scene, name, color? }
// PUT    /api/user-tool-prompt-groups?id=xxx                   body: { name?, color? }
// DELETE /api/user-tool-prompt-groups?id=xxx                   删除分组（提示词的 group_id 置空，不级联删除）
//
// 鉴权：与 user-tool-prompts.js 相同，强制要求登录。
// 数据隔离：每个登录用户各自一份，按 uid + scene 过滤。

import { extractUidFromRequest } from './_lib/model-resolver.js'

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

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

const ALLOWED_SCENES = new Set(['ai-image-edit', 'ai-outfit'])

// 简易组名颜色白名单（前端可选）；不限制时给空即可。
// 避免恶意 SVG 注入或极端值进入 UI。
const ALLOWED_COLORS = new Set([
  '',
  'gray', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple',
  'fuchsia', 'pink', 'rose',
])

function validateGroupInput(body) {
  const errors = []
  const name = (body?.name ?? '').toString().trim()
  const sortOrder = body?.sort_order
  const color = body?.color == null ? '' : body.color.toString().trim()
  if (!name) errors.push('分组名不能为空')
  else if (name.length > 30) errors.push('分组名不能超过 30 字符')
  if (color !== '' && !ALLOWED_COLORS.has(color)) errors.push('不支持的颜色')
  if (sortOrder != null && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
    errors.push('sort_order 必须是非负整数')
  }
  return { errors, name, sortOrder, color }
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env.DB
  const uid = await extractUidFromRequest(request, env).catch(() => '')
  if (!uid) {
    return json({ success: false, error: '请先登录' }, 401)
  }

  const url = new URL(request.url)

  try {
    // ============ GET: 列出某 scene 下当前用户的所有分组 ============
    if (request.method === 'GET') {
      const scene = (url.searchParams.get('scene') || '').trim()
      if (!scene) return json({ success: false, error: '缺少 scene 参数' }, 400)
      if (!ALLOWED_SCENES.has(scene)) {
        return json({ success: false, error: `不支持的场景：${scene}` }, 400)
      }

      const rows = await db
        .prepare(
          `SELECT g.id, g.scene, g.name, g.color, g.sort_order, g.created_at, g.updated_at,
                  (SELECT COUNT(*) FROM user_tool_prompts p
                   WHERE p.uid = g.uid AND p.group_id = g.id) AS prompt_count
           FROM user_tool_prompt_groups g
           WHERE g.uid = ? AND g.scene = ?
           ORDER BY sort_order ASC, created_at ASC`,
        )
        .bind(uid, scene)
        .all()

      return json({ success: true, data: rows.results || [] })
    }

    // ============ POST: 新建分组 ============
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const scene = (body?.scene ?? '').toString().trim()
      if (!ALLOWED_SCENES.has(scene)) {
        return json({ success: false, error: `不支持的场景：${scene}` }, 400)
      }
      const { errors, name, color, sortOrder } = validateGroupInput(body)
      if (errors.length) {
        return json({ success: false, error: errors.join('；') }, 400)
      }

      const id = crypto.randomUUID()
      const now = nowSql()
      try {
        await db
          .prepare(
            `INSERT INTO user_tool_prompt_groups
               (id, uid, scene, name, color, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(id, uid, scene, name, color, sortOrder ?? 0, now, now)
          .run()
      } catch (e) {
        // 同名唯一约束触发：返回 409 让前端给「该分组已存在」提示
        if (String(e?.message || '').includes('UNIQUE')) {
          return json({ success: false, error: '该分组名已存在' }, 409)
        }
        throw e
      }

      return json({
        success: true,
        data: {
          id, scene, name, color,
          sort_order: sortOrder ?? 0,
          prompt_count: 0,
          created_at: now, updated_at: now,
        },
      })
    }

    // ============ PUT: 更新分组名 / 颜色 / 排序 ============
    if (request.method === 'PUT') {
      const id = (url.searchParams.get('id') || '').trim()
      if (!id) return json({ success: false, error: '缺少 id 参数' }, 400)

      const body = await request.json().catch(() => ({}))
      const { errors, name, color, sortOrder } = validateGroupInput(body)
      if (errors.length) {
        return json({ success: false, error: errors.join('；') }, 400)
      }

      // 只允许改 name / color / sort_order，不允许改 scene（避免越权迁移组）
      // 当前端没传某个字段时，保留旧值（用 subquery 拿原值）
      const now = nowSql()
      try {
        const result = await db
          .prepare(
            `UPDATE user_tool_prompt_groups
             SET name = COALESCE(?, name),
                 color = COALESCE(NULLIF(?, ''), color),
                 sort_order = COALESCE(?, sort_order),
                 updated_at = ?
             WHERE id = ? AND uid = ?`,
          )
          .bind(name, color, sortOrder ?? null, now, id, uid)
          .run()

        const changes = result?.meta?.changes ?? result?.changes ?? 0
        if (changes === 0) {
          const exists = await db
            .prepare('SELECT uid FROM user_tool_prompt_groups WHERE id = ?')
            .bind(id)
            .first()
          if (!exists) return json({ success: false, error: '分组不存在' }, 404)
          return json({ success: false, error: '无权操作该分组' }, 403)
        }
      } catch (e) {
        if (String(e?.message || '').includes('UNIQUE')) {
          return json({ success: false, error: '该分组名已存在' }, 409)
        }
        throw e
      }
      return json({ success: true })
    }

    // ============ DELETE: 删除分组（不级联删提示词） ============
    if (request.method === 'DELETE') {
      const id = (url.searchParams.get('id') || '').trim()
      if (!id) return json({ success: false, error: '缺少 id 参数' }, 400)

      // 先把该组下所有提示词的 group_id 置空（不级联删除提示词）
      // 注意：SQLite 不支持 UPDATE...FROM；D1 单条 UPDATE 即可
      await db
        .prepare(
          `UPDATE user_tool_prompts
           SET group_id = NULL, updated_at = ?
           WHERE uid = ? AND group_id = ?`,
        )
        .bind(nowSql(), uid, id)
        .run()

      const result = await db
        .prepare('DELETE FROM user_tool_prompt_groups WHERE id = ? AND uid = ?')
        .bind(id, uid)
        .run()
      const changes = result?.meta?.changes ?? result?.changes ?? 0
      if (changes === 0) {
        const exists = await db
          .prepare('SELECT uid FROM user_tool_prompt_groups WHERE id = ?')
          .bind(id)
          .first()
        if (!exists) return json({ success: false, error: '分组不存在' }, 404)
        return json({ success: false, error: '无权操作该分组' }, 403)
      }
      return json({ success: true })
    }

    return json({ success: false, error: '不支持的请求方法' }, 405)
  } catch (err) {
    console.error('[user-tool-prompt-groups] 错误:', err)
    return json({ success: false, error: err?.message || '服务器错误' }, 500)
  }
}