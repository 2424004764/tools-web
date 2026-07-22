// Admin 启用/禁用用户 API
// POST /api/admin/users/:uid/toggle-disabled
// body: { is_disabled: 0|1, reason?: string }
//
// 不能禁用自己（避免管理员误操作锁死所有管理员账号）。
// 不能禁用其他管理员（防止互相踢下线）。
//
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  const { request, env, data } = context
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const uid = context.params?.uid
  if (!uid) return jsonError('缺少用户 id', 400)

  const body = await request.json().catch(() => ({}))
  const isDisabled = body.is_disabled === 1 || body.is_disabled === true ? 1 : 0
  const reason = (body.reason || '').toString().slice(0, 200)

  // 防止禁用自己的账号
  if (uid === data?.adminUid) {
    return jsonError('不能禁用自己的账号', 400)
  }

  try {
    const existing = await db
      .prepare('SELECT id, is_admin FROM user WHERE id = ?')
      .bind(uid)
      .first()
    if (!existing) return jsonError('用户不存在', 404)

    // 不能禁用其他管理员
    if (existing.is_admin && isDisabled) {
      return jsonError('不能禁用其他管理员', 400)
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await db
      .prepare(
        `UPDATE user
         SET is_disabled = ?, disabled_reason = ?, disabled_at = ?
         WHERE id = ?`,
      )
      .bind(isDisabled, isDisabled ? reason || null : null, isDisabled ? now : null, uid)
      .run()

    return json({ is_disabled: isDisabled })
  } catch (error) {
    console.error('admin/users/[uid]/toggle-disabled error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}