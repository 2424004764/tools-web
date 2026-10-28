// Admin 单用户存储使用明细 API
// GET /api/admin/storage/detail?uid=xxx
//
// 返回：
//   user      基本信息快照（邮箱 / 用户名 / 头像）
//   quota     额度概况（总额度 / 已用 / 预留中 / 可用 / 更新时间）
//   sources   来源拆解（音乐 / AI 创作图 / 子站上传 / 其他）
//   files     最近文件（音乐 + AI 创作图合并，按创建时间倒序取 20 条）
//   uploads   最近子站上传记录（含队列结算状态，倒序取 20 条）
//   otherFiles 「其他」占用的逐文件明细（R2 实时按前缀归集，见 collectOtherFiles）
//
// 鉴权：/api/admin/_middleware.js 已校验管理员，这里无需重复检查。

import { STORAGE_RESERVATION_TTL_SECONDS } from '../../../config/storage.js'

// 「其他」类目 R2 归集上限与展示条数
const OTHER_R2_MAX_OBJECTS = 2000
const OTHER_FILES_LIMIT = 200

// 生成图持久化对象的来源工具（generation_records.source）
const GENERATION_SOURCE_LABELS = {
  'ai-image-edit': 'AI 图片编辑',
  'ai-outfit': 'AI 穿搭',
}

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

function intOr0(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

// 分页列出一个前缀下的 R2 对象（封顶 maxObjects，超出置 truncated）
async function listR2Objects(bucket, prefix, maxObjects) {
  const objects = []
  let cursor
  while (objects.length < maxObjects) {
    const page = await bucket.list({ prefix, limit: 1000, cursor })
    objects.push(...page.objects)
    if (!page.truncated) return { objects, truncated: false }
    cursor = page.cursor
  }
  return { objects, truncated: true }
}

/**
 * 「其他」类目逐文件归集。
 * 其他 = 已用 - 三表可归集来源，其构成在库里没有逐文件记录，但对象都在 R2：
 *   generated-images/{uid}/{recordId}.{ext}  AI 图片编辑 / AI 穿搭生成图持久化
 *   shopping-list/{uid}/…                    购物清单条目图片
 * 这里按前缀实时 list R2（对象自带 size / uploaded），生成图再反查
 * generation_records 把 recordId 映射回来源工具，供后台直接定位用量出处。
 * R2 归集合计与账目残差的差额即历史漂移（如已删对象未退额度），单独返回对账。
 */
async function collectOtherFiles(env, uid) {
  const bucket = env?.MEDIA
  if (!bucket) return { files: [], truncated: false, bytes: 0, total: 0, error: 'R2 绑定未配置' }

  const [generated, shopping] = await Promise.all([
    listR2Objects(bucket, `generated-images/${uid}/`, OTHER_R2_MAX_OBJECTS),
    listR2Objects(bucket, `shopping-list/${uid}/`, OTHER_R2_MAX_OBJECTS),
  ])

  // recordId → 来源工具（生成图 key 的最后一段去掉扩展名即 generation_records.id）
  const toolByRecordId = new Map()
  for (const obj of generated.objects) {
    const last = String(obj.key).split('/').pop() || ''
    const recordId = last.replace(/\.[a-z0-9]+$/i, '')
    if (recordId) toolByRecordId.set(recordId, null)
  }
  if (toolByRecordId.size > 0) {
    const records = await env.DB.prepare(
      'SELECT id, source FROM generation_records WHERE uid = ? LIMIT 5000',
    ).bind(uid).all()
    for (const row of records.results || []) toolByRecordId.set(row.id, row.source || null)
  }

  const toFile = (obj, source, tool) => ({
    source,
    tool: tool == null ? null : GENERATION_SOURCE_LABELS[tool] || tool,
    key: obj.key,
    bytes: intOr0(obj.size),
    uploadedAt: obj.uploaded || null,
  })

  const files = [
    ...generated.objects.map((obj) => {
      const last = String(obj.key).split('/').pop() || ''
      const recordId = last.replace(/\.[a-z0-9]+$/i, '')
      return toFile(obj, 'generated_image', toolByRecordId.get(recordId))
    }),
    ...shopping.objects.map((obj) => toFile(obj, 'shopping_list', null)),
  ].sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')))

  return {
    files: files.slice(0, OTHER_FILES_LIMIT),
    truncated: files.length > OTHER_FILES_LIMIT || generated.truncated || shopping.truncated,
    bytes: files.reduce((sum, f) => sum + f.bytes, 0),
    total: files.length,
  }
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = (new URL(request.url).searchParams.get('uid') || '').trim()
  if (!uid) return jsonError('缺少 uid 参数', 400)

  try {
    // ============ 额度概况 + 用户快照 + 预留 ============
    const [quotaRow, userRow, pendingRow, musicRow, aiRow, subsiteRow] = await db.batch([
      db.prepare('SELECT quota_bytes, used_bytes, updated_at FROM user_storage_quota WHERE uid = ?').bind(uid),
      db.prepare('SELECT email, username, avatar, is_admin FROM user WHERE id = ?').bind(uid),
      db
        .prepare(
          `SELECT COALESCE(SUM(bytes), 0) AS pending FROM storage_reservations
           WHERE uid = ? AND created_at >= datetime('now', ?)`,
        )
        .bind(uid, `-${STORAGE_RESERVATION_TTL_SECONDS} seconds`),
      db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS s FROM music_songs WHERE uid = ?').bind(uid),
      db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS s FROM ai_creation_images WHERE uid = ?').bind(uid),
      db
        .prepare(
          `SELECT COUNT(*) AS c, COALESCE(SUM(COALESCE(actual_bytes, declared_bytes)), 0) AS s
           FROM subsite_uploads WHERE uid = ? AND status = 'settled'`,
        )
        .bind(uid),
    ])

    const quotaBytes = intOr0(quotaRow?.results?.[0]?.quota_bytes)
    const usedBytes = intOr0(quotaRow?.results?.[0]?.used_bytes)
    const pendingBytes = intOr0(pendingRow?.results?.[0]?.pending)
    const music = { count: intOr0(musicRow?.results?.[0]?.c), bytes: intOr0(musicRow?.results?.[0]?.s) }
    const aiCreation = { count: intOr0(aiRow?.results?.[0]?.c), bytes: intOr0(aiRow?.results?.[0]?.s) }
    const subsite = { count: intOr0(subsiteRow?.results?.[0]?.c), bytes: intOr0(subsiteRow?.results?.[0]?.s) }
    const identified = music.bytes + aiCreation.bytes + subsite.bytes

    // ============ 最近文件（音乐 + AI 创作图合并倒序） ============
    const filesResult = await db
      .prepare(
        `SELECT * FROM (
           SELECT 'music' AS type, title AS name, file_size AS bytes, created_at
           FROM music_songs WHERE uid = ?
           UNION ALL
           SELECT 'ai_creation' AS type,
                  COALESCE(NULLIF(filename, ''), NULLIF(prompt, ''), 'image') AS name,
                  file_size AS bytes, created_at
           FROM ai_creation_images WHERE uid = ?
         )
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .bind(uid, uid)
      .all()

    // ============ 最近子站上传记录（带应用名，观察队列结算状态） ============
    const uploadsResult = await db
      .prepare(
        `SELECT s.id, s.client_id, c.name AS client_name, s.object_key, s.content_type,
                s.declared_bytes, s.actual_bytes, s.status, s.created_at, s.settled_at
         FROM subsite_uploads s
         LEFT JOIN oauth_clients c ON c.client_id = s.client_id
         WHERE s.uid = ?
         ORDER BY s.created_at DESC
         LIMIT 20`,
      )
      .bind(uid)
      .all()

    // ============ 有效预留清单（观察卡单：哪笔预扣迟迟未结算） ============
    const reservationsResult = await db
      .prepare(
        `SELECT id, bytes, created_at FROM storage_reservations
         WHERE uid = ? AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .bind(uid, `-${STORAGE_RESERVATION_TTL_SECONDS} seconds`)
      .all()

    const user = userRow?.results?.[0]

    // ============ 「其他」占用逐文件归集（R2 实时列出，失败不阻塞整体明细） ============
    let otherFiles = []
    let otherFilesTruncated = false
    let otherBytesFromR2 = 0
    let otherFilesError = null
    let otherTotal = 0
    try {
      const collected = await collectOtherFiles(env, uid)
      otherFiles = collected.files
      otherFilesTruncated = collected.truncated
      otherBytesFromR2 = collected.bytes
      otherFilesError = collected.error || null
      otherTotal = collected.total
    } catch (error) {
      console.error('[admin/storage/detail] collectOtherFiles failed:', error)
      otherFilesError = error?.message || 'R2 归集失败'
    }

    return json({
      user: {
        uid,
        email: user?.email || null,
        username: user?.username || null,
        avatar: user?.avatar || null,
        isAdmin: !!user?.is_admin,
      },
      quota: {
        quotaBytes,
        usedBytes,
        pendingBytes,
        availableBytes: Math.max(0, quotaBytes - usedBytes - pendingBytes),
        updatedAt: quotaRow?.results?.[0]?.updated_at || null,
        // 无额度行 = 该用户从未产生过存储上传
        exists: !!quotaRow?.results?.[0],
      },
      sources: {
        music,
        aiCreation,
        subsite,
        // 已用减去可归集来源：生成图持久化（generated-images）、购物清单图片、历史漂移等
        // count 为 R2 归集到的对象数（见 otherFiles），字节仍是账目残差口径
        other: {
          count: otherFilesError ? 0 : otherTotal,
          bytes: Math.max(0, usedBytes - identified),
        },
      },
      // 「其他」占用的逐文件明细：R2 实时按前缀归集；bytes 为归集合计，
      // 与 sources.other.bytes（账目残差）的差额即历史漂移（已删对象未退额度等）
      otherFiles,
      otherFilesTruncated,
      otherBytesFromR2,
      otherFilesError,
      // 有效预留明细（>0 且长期不消说明结算链路异常，可在前端一键清理）
      reservations: (reservationsResult.results || []).map((r) => ({
        id: r.id,
        bytes: intOr0(r.bytes),
        createdAt: r.created_at,
      })),
      files: (filesResult.results || []).map((f) => ({
        type: f.type,
        name: f.name || '-',
        bytes: intOr0(f.bytes),
        createdAt: f.created_at,
      })),
      uploads: (uploadsResult.results || []).map((u) => ({
        id: u.id,
        clientId: u.client_id,
        clientName: u.client_name || null,
        filename: String(u.object_key || '').split('/').pop() || u.object_key,
        contentType: u.content_type || '',
        declaredBytes: intOr0(u.declared_bytes),
        actualBytes: u.actual_bytes == null ? null : intOr0(u.actual_bytes),
        status: u.status || 'pending',
        createdAt: u.created_at,
        settledAt: u.settled_at || null,
      })),
    })
  } catch (error) {
    console.error('[admin/storage/detail] error:', error)
    return jsonError(error.message || '服务器错误')
  }
}
