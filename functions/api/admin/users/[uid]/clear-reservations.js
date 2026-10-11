// Admin 清理用户上传预留（预扣）API
// POST /api/admin/users/:uid/clear-reservations
//
// 背景：上传前 reserveStorage 预扣额度，正常流程由 settle/release 删除预留；
// 超过 1 小时（STORAGE_RESERVATION_TTL_SECONDS）的预留已不参与可用额度计算，
// 超过 24 小时的行只会在该用户下次 reserve 时被顺带清扫。若某用户的预扣长期
// 挂着不动，说明结算链路（队列实扣 / 前端 release）出了问题——此处提供手动清理。
//
// 行为：删除该用户名下【全部】预留（含已过期未清扫的垃圾行），返回删除数与清理前的预扣量。
// 风险：若恰有上传正在途（预留真实有效），删除后该次上传的 settle 仍会正常累加
// used_bytes（settle 不依赖预留行存在），仅短暂绕过额度闸门，不会产生账目错乱。
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

  try {
    const user = await db.prepare('SELECT id FROM user WHERE id = ?').bind(uid).first()
    if (!user) return jsonError('用户不存在', 404)

    const before = await db
      .prepare('SELECT COUNT(*) AS c, COALESCE(SUM(bytes), 0) AS s FROM storage_reservations WHERE uid = ?')
      .bind(uid)
      .first()
    const countBefore = Number(before?.c) || 0
    const bytesBefore = Number(before?.s) || 0

    if (countBefore === 0) {
      return json({ uid, deleted: 0, bytesBefore: 0, message: '该用户没有待清理的预留' })
    }

    const result = await db
      .prepare('DELETE FROM storage_reservations WHERE uid = ?')
      .bind(uid)
      .run()
    const deleted = result?.meta?.changes ?? 0

    return json({
      uid,
      deleted,
      bytesBefore,
      operatorUid: data?.adminUid || 'SYSTEM',
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
  } catch (error) {
    console.error('admin/clear-reservations error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
