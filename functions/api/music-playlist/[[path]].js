// 音乐播放列表 —— 登录用户的私有 CRUD
//   POST   /api/music-playlist/songs/upload-url          签发 R2 SigV4 预签名 PUT URL
//   POST   /api/music-playlist/songs                     创建歌曲元数据
//   GET    /api/music-playlist/songs                     我的歌曲列表（分页 + 关键字）
//   GET    /api/music-playlist/songs/{id}                歌曲详情（含所属歌单）
//   PATCH  /api/music-playlist/songs/{id}                编辑（标题/艺人/专辑/公开）
//   DELETE /api/music-playlist/songs/{id}                删除（含 R2 对象 + 级联 join）
//   POST   /api/music-playlist/songs/{id}/play           +1（可选鉴权）
//   GET    /api/music-playlist/playlists                 我的歌单列表（分页）
//   POST   /api/music-playlist/playlists                 创建歌单（可附带 songIds）
//   GET    /api/music-playlist/playlists/{id}            歌单详情（含顺序歌曲）
//   PATCH  /api/music-playlist/playlists/{id}            编辑 + 增删改歌曲
//   DELETE /api/music-playlist/playlists/{id}            删除（级联 join）
//
// 公开端点另见：music-playlist/song/[slug].js、music-playlist/playlist/[slug].js

import { ApiResponse, initDatabase, Pager } from '../../utils/db.js'
import { AuthMiddleware } from '../../middlewares/auth.js'
import {
  MusicService,
  ValidationError,
  calcCreditCost,
  splitBatchByFreeQuota,
  releaseFreeQuota,
  parseFreeBytesFromReason,
  MAX_FILE_SIZE_BYTES,
} from '../../services/musicService.js'
import { MUSIC_MB_PER_CREDIT, MUSIC_FREE_QUOTA_BYTES } from '../../config/music.js'

// 解析 /api/music-playlist/songs/{id}/play → { collection:'songs', id, action:'play' }
// 解析 /api/music-playlist/songs/{txId}/reverse → { collection:'songs', id:txId, action:'reverse' }
function parseSongSubPath(path) {
  // path 形如 /songs/{id}/play | /songs/{txId}/reverse | /songs/{id}
  const m = path.match(/^\/songs\/([^/]+)(?:\/(play|reverse))?\/?$/)
  if (!m) return null
  return { collection: 'songs', id: m[1], action: m[2] || null }
}

function parsePlaylistSubPath(path) {
  // path 形如 /playlists/{id}
  const m = path.match(/^\/playlists\/([^/]+)\/?$/)
  if (!m) return null
  return { collection: 'playlists', id: m[1], action: null }
}

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/music-playlist', '') || '/'
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return ApiResponse.cors(origin)
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) return dbInit.response

  // 全部接口都需要登录（公开端点另走 /song/[slug].js / /playlist/[slug].js）
  const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
  if (!authResult.success) {
    return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
  }
  const uid = authResult.user.id

  try {
    const service = new MusicService(dbInit.db, env)

    // ============ 路由分发 ============

    // GET /songs/quote?fileSizes=1048576,3145728  上传前的 cost 预览（不扣费）
    // fileSizes 为空时也允许：仅返回配置（mbPerCredit / freeQuotaTotal / maxFileSizeBytes）+ 余额
    //   便于前端在弹窗打开、用户未选文件时拉一次拿到所有配置，避免硬编码兜底。
    if (request.method === 'GET' && path === '/songs/quote') {
      const rawSizes = url.searchParams.getAll('fileSizes')
      const sizes = []
      for (const s of rawSizes) {
        const n = Number(s)
        if (!Number.isFinite(n) || n <= 0 || n > MAX_FILE_SIZE_BYTES) {
          return ApiResponse.error(`fileSize 不合法：${s}（需 1 ~ ${MAX_FILE_SIZE_BYTES}）`, origin, 400)
        }
        sizes.push(n)
      }

      const db = dbInit.db
      const mbPerCredit = MUSIC_MB_PER_CREDIT
      const freeQuotaTotal = MUSIC_FREE_QUOTA_BYTES
      const maxFileSizeBytes = MAX_FILE_SIZE_BYTES

      const totalSize = sizes.reduce((s, x) => s + x, 0)

      // 读用户已用免费额度（music_user_quota 行可能不存在 → 0）
      let freeQuotaUsed = 0
      try {
        const quotaRow = await db
          .prepare('SELECT free_bytes_used FROM music_user_quota WHERE uid = ? LIMIT 1')
          .bind(uid).first()
        freeQuotaUsed = Number(quotaRow?.free_bytes_used) || 0
      } catch { /* 表不存在（迁移没跑）→ 兜底 0 */ }

      // 读余额（配置版也返回，前端首次开弹窗时拿到就不用再调 /me/credits）
      const balanceRow = await db
        .prepare('SELECT balance FROM user_credits WHERE uid = ?')
        .bind(uid).first()
      const balance = balanceRow?.balance ?? 0

      // 空 sizes：只返回配置 + 余额，不算 cost
      if (sizes.length === 0) {
        return ApiResponse.success({
          sizes: [], totalSize: 0,
          totalCost: 0,
          freeBytes: 0,
          paidBytes: 0,
          freeQuotaUsed,
          freeQuotaTotal,
          balance,
          mbPerCredit,
          maxFileSizeBytes,
        }, origin)
      }

      // 非空：按免费额度拆分本次批次
      const { freeBytes, paidBytes, cost } = splitBatchByFreeQuota(totalSize, freeQuotaUsed)

      return ApiResponse.success({
        sizes, totalSize,
        totalCost: cost,
        freeBytes,
        paidBytes,
        freeQuotaUsed,
        freeQuotaTotal,
        balance,
        mbPerCredit,
        maxFileSizeBytes,
      }, origin)
    }

    // POST /songs/upload-url  单独优先匹配，避免被 parseSongSubPath 误吞
    if (request.method === 'POST' && path === '/songs/upload-url') {
      const body = await request.json().catch(() => ({}))
      const result = await service.requestUploadUrl(uid, body)
      return ApiResponse.success(result, origin)
    }

    // POST /songs          创建
    // GET  /songs          列表
    if (request.method === 'POST' && path === '/songs') {
      const body = await request.json().catch(() => ({}))
      const created = await service.createSong(uid, body)
      return ApiResponse.success(created, origin, 201)
    }
    if (request.method === 'GET' && path === '/songs') {
      const pager = Pager.fromRequest(request, 20)
      pager.pageSize = Math.min(pager.pageSize, 50)
      const keyword = url.searchParams.get('keyword') || ''
      const { list, total } = await service.listMySongs(uid, {
        page: pager.page,
        pageSize: pager.pageSize,
        keyword,
      })
      return ApiResponse.success(pager.createResult(list, total), origin)
    }

    // /songs/{id} 与 /songs/{id}/play 与 /songs/{txId}/reverse
    const songMatch = parseSongSubPath(path)
    if (songMatch) {
      if (songMatch.action === 'play') {
        if (request.method !== 'POST') {
          return ApiResponse.error('不支持的请求方法', origin, 405)
        }
        // 拥有者自己播放也计入（不强制公开）
        const playCount = await service.incrementSongPlayCount(songMatch.id)
        if (playCount === 0) {
          return ApiResponse.error('歌曲不存在', origin, 404)
        }
        return ApiResponse.success({ playCount }, origin)
      }
      if (songMatch.action === 'reverse') {
        if (request.method !== 'POST') {
          return ApiResponse.error('不支持的请求方法', origin, 405)
        }
        // txId 必须是 uuid；通过流水反查 uid 匹配 owner
        const txId = songMatch.id
        if (!/^[0-9a-f-]{36}$/i.test(txId)) {
          return ApiResponse.error('txId 不合法', origin, 400)
        }
        const txRow = await dbInit.db
          .prepare(
            `SELECT id, uid, type, amount, reason
             FROM credit_transactions
             WHERE id = ? LIMIT 1`,
          )
          .bind(txId).first()
        if (!txRow) return ApiResponse.error('流水不存在', origin, 404)
        if (txRow.uid !== uid) return ApiResponse.error('无权操作该流水', origin, 403)
        if (txRow.type !== 'deduct') {
          return ApiResponse.error(`只能反向 deduct 类型（当前 ${txRow.type}）`, origin, 400)
        }
        const amount = Math.abs(Number(txRow.amount) || 0)
        if (amount <= 0) return ApiResponse.error('流水金额异常', origin, 400)

        // 从原 deduct 流水 reason 解析出 freeBytes（如果有）→ 释放免费额度
        // 旧 reason 不含此字段 → 0；新 reason 形如 music-playlist:upload:size=...B:freeBytes=...B
        const freeBytesToRelease = parseFreeBytesFromReason(txRow.reason)

        // 用 type='reverse'（避免与 deleteSong 的 type='refund' 混流水语义）
        // 直接调用 service 内的回购逻辑：写入 reverse 流水 + UPDATE balance
        const env = context.env
        await (async () => {
          const db = env.DB
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
          const reverseTxId = crypto.randomUUID()
          const updateResult = await db
            .prepare(
              `UPDATE user_credits
               SET balance = balance + ?,
                   total_spent = CASE WHEN total_spent >= ? THEN total_spent - ? ELSE 0 END,
                   updated_at = ?
               WHERE uid = ?
               RETURNING balance`,
            )
            .bind(amount, amount, amount, now, uid)
            .first()
          const actualBalance = updateResult?.balance ?? 0
          try {
            await db
              .prepare(
                `INSERT INTO credit_transactions
                 (id, uid, type, amount, balance_after, reason, operator_uid, source, related_tx_id, idempotency_key, created_at)
                 VALUES (?, ?, 'reverse', ?, ?, ?, ?, 'tool', ?, NULL, ?)`,
              )
              .bind(reverseTxId, uid, amount, actualBalance,
                'music-playlist:upload-failed', 'SYSTEM', txId, now)
              .run()
          } catch (err) {
            // UNIQUE(related_tx_id) 冲突：已退过
            const msg = err?.message || ''
            if (!/UNIQUE.*related_tx_id/i.test(msg)) throw err
          }
        })()

        // 释放免费额度（与积分退还解耦，失败仅记日志，不阻塞主响应）
        if (freeBytesToRelease > 0) {
          try {
            await releaseFreeQuota(dbInit.db, uid, freeBytesToRelease)
          } catch (err) {
            console.error('[music-playlist] reverse releaseFreeQuota failed (continuing):', err?.message || err)
          }
        }

        return ApiResponse.success({ reversed: true, txId, amount }, origin)
      }
      switch (request.method) {
        case 'GET': {
          const detail = await service.getSongForOwner(songMatch.id, uid)
          if (!detail) return ApiResponse.error('歌曲不存在', origin, 404)
          return ApiResponse.success(detail, origin)
        }
        case 'PATCH': {
          const body = await request.json().catch(() => ({}))
          const updated = await service.updateSong(songMatch.id, uid, body)
          if (!updated) return ApiResponse.error('歌曲不存在', origin, 404)
          return ApiResponse.success(updated, origin)
        }
        case 'DELETE': {
          const ok = await service.deleteSong(songMatch.id, uid)
          if (!ok) return ApiResponse.error('歌曲不存在', origin, 404)
          return ApiResponse.success({ success: true }, origin)
        }
        default:
          return ApiResponse.error('不支持的请求方法', origin, 405)
      }
    }

    // POST /playlists          创建
    // GET  /playlists          列表
    if (request.method === 'POST' && path === '/playlists') {
      const body = await request.json().catch(() => ({}))
      const created = await service.createPlaylist(uid, body)
      return ApiResponse.success(created, origin, 201)
    }
    if (request.method === 'GET' && path === '/playlists') {
      const pager = Pager.fromRequest(request, 20)
      pager.pageSize = Math.min(pager.pageSize, 50)
      const { list, total } = await service.listMyPlaylists(uid, {
        page: pager.page,
        pageSize: pager.pageSize,
      })
      return ApiResponse.success(pager.createResult(list, total), origin)
    }

    // /playlists/{id}
    const playlistMatch = parsePlaylistSubPath(path)
    if (playlistMatch) {
      switch (request.method) {
        case 'GET': {
          const detail = await service.getPlaylistForOwner(playlistMatch.id, uid)
          if (!detail) return ApiResponse.error('歌单不存在', origin, 404)
          return ApiResponse.success(detail, origin)
        }
        case 'PATCH': {
          const body = await request.json().catch(() => ({}))
          const updated = await service.updatePlaylist(playlistMatch.id, uid, body)
          if (!updated) return ApiResponse.error('歌单不存在', origin, 404)
          return ApiResponse.success(updated, origin)
        }
        case 'DELETE': {
          const ok = await service.deletePlaylist(playlistMatch.id, uid)
          if (!ok) return ApiResponse.error('歌单不存在', origin, 404)
          return ApiResponse.success({ success: true }, origin)
        }
        default:
          return ApiResponse.error('不支持的请求方法', origin, 405)
      }
    }

    return ApiResponse.error('不支持的请求路径', origin, 404)
  } catch (error) {
    if (error instanceof ValidationError) {
      return ApiResponse.error(error.message, origin, 400)
    }
    console.error('MusicPlaylist API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}