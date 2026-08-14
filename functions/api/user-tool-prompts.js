// 用户级提示词库 API
// GET    /api/user-tool-prompts?scene=ai-image-edit  列出当前用户在某场景下的全部提示词
// POST   /api/user-tool-prompts                       body: { scene, title, content }
// PUT    /api/user-tool-prompts?id=xxx                body: { title, content }
// DELETE /api/user-tool-prompts?id=xxx                删除单条
//
// 场景标识（scene）取值：'ai-image-edit' / 'ai-outfit'
// 数据隔离：每个登录用户各自一份，按 uid + scene 过滤；PUT/DELETE 强校验 uid 防止越权。

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

/** 简单 scene 白名单；新工具加进 tools.ts 时同步加这里 */
const ALLOWED_SCENES = new Set(['ai-image-edit', 'ai-outfit'])

/** title/content 入参校验：title 可空（为空时列表显示「未命名」），content 必填 */
function validatePromptInput(body) {
  const errors = []
  const title = (body?.title ?? '').toString().trim()
  const content = (body?.content ?? '').toString().trim()
  if (title.length > 50) errors.push('标题不能超过 50 字符')
  if (!content) errors.push('提示词内容不能为空')
  else if (content.length > 5000) errors.push('提示词不能超过 5000 字符（与上游 prompt 上限一致）')
  return { errors, title, content }
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
    // ============ GET: 列出某 scene 下当前用户的所有提示词 ============
    if (request.method === 'GET') {
      const scene = (url.searchParams.get('scene') || '').trim()
      if (!scene) {
        return json({ success: false, error: '缺少 scene 参数' }, 400)
      }
      if (!ALLOWED_SCENES.has(scene)) {
        return json({ success: false, error: `不支持的场景：${scene}` }, 400)
      }
      const rows = await db
        .prepare(
          `SELECT id, scene, title, content, created_at, updated_at
           FROM user_tool_prompts
           WHERE uid = ? AND scene = ?
           ORDER BY updated_at DESC`,
        )
        .bind(uid, scene)
        .all()
      return json({ success: true, data: rows.results || [] })
    }

    // ============ POST: 新建一条 ============
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const scene = (body?.scene ?? '').toString().trim()
      if (!ALLOWED_SCENES.has(scene)) {
        return json({ success: false, error: `不支持的场景：${scene}` }, 400)
      }
      const { errors, title, content } = validatePromptInput(body)
      if (errors.length) {
        return json({ success: false, error: errors.join('；') }, 400)
      }

      const id = crypto.randomUUID()
      const now = nowSql()
      await db
        .prepare(
          `INSERT INTO user_tool_prompts (id, uid, scene, title, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, uid, scene, title, content, now, now)
        .run()

      return json({
        success: true,
        data: { id, scene, title, content, created_at: now, updated_at: now },
      })
    }

    // ============ PUT: 更新一条（必须属于当前用户） ============
    if (request.method === 'PUT') {
      const id = (url.searchParams.get('id') || '').trim()
      if (!id) {
        return json({ success: false, error: '缺少 id 参数' }, 400)
      }
      const body = await request.json().catch(() => ({}))
      const { errors, title, content } = validatePromptInput(body)
      if (errors.length) {
        return json({ success: false, error: errors.join('；') }, 400)
      }

      // 先校验归属：UPDATE 的 WHERE 带 uid，避免改到别人的数据
      const now = nowSql()
      const result = await db
        .prepare(
          `UPDATE user_tool_prompts
           SET title = ?, content = ?, updated_at = ?
           WHERE id = ? AND uid = ?`,
        )
        .bind(title, content, now, id, uid)
        .run()

      const changes = result?.meta?.changes ?? result?.changes ?? 0
      if (changes === 0) {
        // 区分「不存在」和「越权」：再查一次
        const exists = await db
          .prepare('SELECT uid FROM user_tool_prompts WHERE id = ?')
          .bind(id)
          .first()
        if (!exists) return json({ success: false, error: '提示词不存在' }, 404)
        return json({ success: false, error: '无权操作该提示词' }, 403)
      }
      return json({ success: true })
    }

    // ============ DELETE: 删除一条（必须属于当前用户） ============
    if (request.method === 'DELETE') {
      const id = (url.searchParams.get('id') || '').trim()
      if (!id) {
        return json({ success: false, error: '缺少 id 参数' }, 400)
      }

      const result = await db
        .prepare('DELETE FROM user_tool_prompts WHERE id = ? AND uid = ?')
        .bind(id, uid)
        .run()
      const changes = result?.meta?.changes ?? result?.changes ?? 0
      if (changes === 0) {
        const exists = await db
          .prepare('SELECT uid FROM user_tool_prompts WHERE id = ?')
          .bind(id)
          .first()
        if (!exists) return json({ success: false, error: '提示词不存在' }, 404)
        return json({ success: false, error: '无权操作该提示词' }, 403)
      }
      return json({ success: true })
    }

    return json({ success: false, error: '不支持的请求方法' }, 405)
  } catch (err) {
    console.error('[user-tool-prompts] 错误:', err)
    return json({ success: false, error: err?.message || '服务器错误' }, 500)
  }
}