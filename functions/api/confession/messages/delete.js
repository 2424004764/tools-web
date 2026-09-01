/**
 * 删除任意告白（仅管理员）
 *
 * DELETE /api/confession/messages/delete?id=<messageId>
 * Headers: Authorization: Bearer <JWT>
 *
 * 管理员判断：复用 functions/api/_lib/model-resolver.js 的 isAdmin()
 *
 * 删除行为：Supabase ON DELETE CASCADE 会自动级联删除该告白下的所有 reactions
 *
 * ⚠️ 高危操作：会永久删除该告白及所有点赞/抱抱数据。请谨慎执行。
 */
import { extractUidFromRequest, isAdmin } from '../../_lib/model-resolver.js'

const corsHeaders = {

  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'DELETE') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    // 1. 鉴权
    const uid = await extractUidFromRequest(request, env)
    if (!uid) {
      return json({ ok: false, error: '未登录或登录已过期' }, 401)
    }

    // 2. 管理员校验
    const db = env.DB
    if (!db) {
      console.error('[confession-delete] D1 未绑定')
      return json({ ok: false, error: '服务器配置错误（D1 未绑定）' }, 500)
    }
    const admin = await isAdmin(db, uid)
    if (!admin) {
      return json({ ok: false, error: '仅管理员可删除告白' }, 403)
    }

    // 3. 取 message_id
    const url = new URL(request.url)
    const messageId = url.searchParams.get('id')
    if (!messageId) {
      return json({ ok: false, error: '缺少告白 id 参数' }, 400)
    }
    // 简单 UUID 格式校验，防止 SQL 注入
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
      return json({ ok: false, error: '告白 id 格式错误' }, 400)
    }

    // 4. 写 Supabase
    const supabaseUrl = env.SUPABASE_URL || ''
    const supabaseKey = env.SUPABASE_SERVICE_KEY || ''
    if (!supabaseUrl || !supabaseKey) {
      console.error('[confession-delete] Supabase env missing', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey })
      return json({ ok: false, error: '服务器配置错误（Supabase 环境变量缺失）' }, 500)
    }

    // 先查询告白信息（取前 80 字回传给前端做提示）
    console.log('[confession-delete] GET messageId=', messageId)
    const getResp = await fetch(
      `${supabaseUrl}/rest/v1/confession_messages?id=eq.${messageId}&select=id,content,group_id`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )
    console.log('[confession-delete] GET status=', getResp.status)
    if (!getResp.ok) {
      const txt = await getResp.text()
      console.error('[confession-delete] GET failed:', getResp.status, txt)
      return json({ ok: false, error: `查询告白失败 (${getResp.status}): ${txt}` }, 500)
    }
    const messages = await getResp.json()
    if (!messages || messages.length === 0) {
      return json({ ok: false, error: '告白不存在或已被删除' }, 404)
    }
    const msg = messages[0]
    const preview = (msg.content || '').slice(0, 80)

    // 执行删除（ON DELETE CASCADE 会级联删除相关 reactions）
    console.log('[confession-delete] DELETE start messageId=', messageId)
    const delResp = await fetch(
      `${supabaseUrl}/rest/v1/confession_messages?id=eq.${messageId}`,
      {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=representation',
        },
      }
    )
    console.log('[confession-delete] DELETE status=', delResp.status)

    if (!delResp.ok) {
      const text = await delResp.text()
      console.error(
        '[confession-delete] DELETE failed:',
        delResp.status,
        text,
        'messageId=',
        messageId,
      )
      return json({ ok: false, error: `删除失败 (${delResp.status}): ${text || '未知错误'}` }, 500)
    }

    return json({
      ok: true,
      deleted: { id: messageId, preview },
      message: '告白已永久删除',
    })
  } catch (e) {
    console.error(
      '[confession-delete] UNCAUGHT ERROR:',
      e?.message,
      e?.stack,
      '\nenvKeys:',
      { hasDb: !!context?.env?.DB, hasSupaUrl: !!context?.env?.SUPABASE_URL, hasSupaKey: !!context?.env?.SUPABASE_SERVICE_KEY },
    )
    return json(
      {
        ok: false,
        error: `服务器内部错误: ${e?.message || 'unknown'}`,
      },
      500,
    )
  }
}
