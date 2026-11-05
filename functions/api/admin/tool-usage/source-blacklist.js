// Admin 工具使用来源黑名单管理
//   GET    /api/admin/tool-usage/source-blacklist   列出全部黑名单来源
//   POST   /api/admin/tool-usage/source-blacklist   批量拉黑 body: { sources: string[] | string, reason? }
//   DELETE /api/admin/tool-usage/source-blacklist   批量移除 body: { sources: string[] | string }
// 鉴权：目录中间件 _middleware.js 已保证 admin（context.data.adminUid）
//
// 拉黑仅影响 admin 统计与明细查询（过滤展示），tool_usage_records 记录本身保留，可随时解禁。

import { loadSourceBlacklist, normalizeSourceKey } from '../../../utils/source-blacklist.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

// 请求体 → 规范化去重后的来源数组；兼容单字符串与数组两种入参
function extractSources(body) {
  const raw = body?.sources
  const list = Array.isArray(raw) ? raw : [raw]
  const seen = new Set()
  for (const item of list) {
    const key = normalizeSourceKey(item)
    // 'direct' 不允许拉黑：每条无来源记录都归 direct，拉黑它会清空全部统计
    if (key && key !== 'direct') seen.add(key)
  }
  return [...seen]
}

export async function onRequest(context) {
  const { request, env, data } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  try {
    if (request.method === 'GET') {
      const rows = await db
        .prepare(
          `SELECT source, reason, created_by, created_by_email, created_at
           FROM tool_usage_source_blacklist ORDER BY created_at DESC`,
        )
        .all()
      return json({ list: rows.results || [] })
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)
      const sources = extractSources(body)
      if (!sources.length) return jsonError('无有效来源（direct 不可拉黑）', 400)
      const reason = String(body.reason || '').trim().slice(0, 100)

      const adminUid = data?.adminUid || null
      let adminEmail = ''
      if (adminUid) {
        const u = await db.prepare(`SELECT email FROM user WHERE id = ?`).bind(adminUid).first()
        adminEmail = u?.email || ''
      }

      // INSERT OR IGNORE：已在黑名单的来源保持原记录不变，不覆盖原因/时间
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO tool_usage_source_blacklist
           (source, reason, created_by, created_by_email)
         VALUES (?, ?, ?, ?)`,
      )
      for (const s of sources) {
        await stmt.bind(s, reason, adminUid, adminEmail).run()
      }
      return json({ added: sources })
    }

    if (request.method === 'DELETE') {
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') return jsonError('请求体需为 JSON', 400)
      const sources = extractSources(body)
      if (!sources.length) return jsonError('无有效来源', 400)
      // json_each 单参数绑定：避免 IN (?,...) 逐个绑定在批量解禁时超过 D1 每查询 100 参数上限
      await db
        .prepare(`DELETE FROM tool_usage_source_blacklist WHERE source IN (SELECT value FROM json_each(?))`)
        .bind(JSON.stringify(sources))
        .run()
      return json({ removed: sources.length })
    }

    return jsonError('不支持的请求方法', 405)
  } catch (err) {
    console.error('[admin/tool-usage/source-blacklist] error:', err)
    return jsonError(err.message || '服务器错误', 500)
  }
}
