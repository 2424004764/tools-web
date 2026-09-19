// 音乐播放列表 —— D1 CRUD + R2 SigV4 预签名 PUT 签发
// 表结构见 migrations/056_create_music_tables.sql
//
// 鉴权策略：
//   - 所有 *My 端点（listMySongs / listMyPlaylists / createSong / ...）由路由层
//     用 AuthMiddleware.extractUserFromRequest 校验后再调入；这里不再二次校验
//   - getPublicSongBySlug / getPublicPlaylistBySlug / incrementPlayCount 无需鉴权
//
// 公开播放策略：
//   - 桶通过 R2.dev 子域开公开读，前端 <audio src> 直接拿 publicAudioUrl 播放
//   - play_count 与 view_count 在公开读取时 +1，失败不影响主响应（仿 travelMapsService）
//
// 存储计费（079 迁移起）：音乐上传并入统一存储额度（原独立免费额度 + 积分按量计费已废弃）：
//   - upload-url：reserveStorage 预扣（额度不足 → ValidationError，路由层转 402）
//   - createSong：按 R2 真实大小结算（settleReservation，多退少补）
//   - deleteSong：退回额度（积分不退）

import {
  reserveStorage,
  settleReservation,
  releaseReservation,
  refundStorageUsage,
} from './storageQuotaService.js'
// R2 SigV4 预签名与公网 URL 构造已抽到共享模块 r2.js；
// 这里用别名 import 保留 musicService.js 内部既有调用风格：
//   _signR2PutUrl(...)     → signR2PutUrl(...)
//   _buildR2PublicUrl(...) → buildR2PublicUrl(...)
//   _deleteR2Object(...)   → deleteR2Object(...)
import {
  signR2PutUrl as _signR2PutUrl,
  buildR2PublicUrl as _buildR2PublicUrl,
  deleteR2Object as _deleteR2Object,
  headR2ObjectSize as _headR2ObjectSize,
} from './r2.js'

// 内部无前缀调用：直接用顶部 _ 别名（line 523 / 747 / 750 等位置直接写 _signR2PutUrl(...) / _deleteR2Object(...)）

// ============ 常量 ============

export const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024 // 30 MB
export const MAX_TITLE = 100
export const MAX_ARTIST = 80
export const MAX_ALBUM = 80
export const MAX_DESCRIPTION = 500
export const MAX_PLAYLIST_SONGS = 500
const SLIG_LEN = 8
const PRESIGN_EXPIRES_SECONDS = 900 // 15 分钟
const PUBLIC_HOST_FALLBACK = '' // 没配 R2_PUBLIC_HOST 时返回空，前端走 R2.dev 默认

// ============ 上传校验 ============
const SHA256_REGEX = /^[a-f0-9]{64}$/

const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
])

// 文件扩展名映射
const EXT_BY_MIME = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
}

class ValidationError extends Error {}

const now = () => new Date().toISOString()

function str(value, max, fallback = '') {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, max)
}

function finiteNum(value) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function safeFilename(name) {
  const s = typeof name === 'string' ? name : ''
  // 去掉路径分隔符与可疑字符，只保留字母数字 / 中文 / dot / dash / underscore / space
  return s.replace(/[^\w.\-一-龥 ]/g, '_').slice(0, 120)
}

// ============ 出参整形 ============

function songFromRow(row) {
  return {
    id: row.id,
    uid: row.uid,
    slug: row.slug,
    title: row.title,
    artist: row.artist || '',
    album: row.album || '',
    coverR2Key: row.cover_r2_key || null,
    audioR2Key: row.audio_r2_key,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    durationSec: row.duration_sec === null || row.duration_sec === undefined ? null : row.duration_sec,
    isPublic: row.is_public === 1,
    playCount: row.play_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function songMetaFromRow(row, playUrl = '') {
  const full = songFromRow(row)
  return {
    id: full.id,
    slug: full.slug,
    title: full.title,
    artist: full.artist,
    album: full.album,
    mimeType: full.mimeType,
    fileSize: full.fileSize,
    durationSec: full.durationSec,
    isPublic: full.isPublic,
    playCount: full.playCount,
    playUrl,
    updatedAt: full.updatedAt,
  }
}

function playlistFromRow(row) {
  return {
    id: row.id,
    uid: row.uid,
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    isPublic: row.is_public === 1,
    viewCount: row.view_count,
    songCount: row.song_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function playlistMetaFromRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    isPublic: row.is_public === 1,
    viewCount: row.view_count,
    songCount: row.song_count,
    updatedAt: row.updated_at,
  }
}

// ============ SigV4 (R2 兼容 S3) 预签名 PUT 签发 ============
// 全部 helper 与签名逻辑已抽到 ./r2.js；这里只保留 musicService 自身的便利方法。
// 维持外部调用风格不变：
//   - signR2PutUrl  → _signR2PutUrl（r2.js 实现）
//   - buildPublicUrl → _buildR2PublicUrl（r2.js 实现）
//   - deleteR2Object → _deleteR2Object（r2.js 实现）
// 函数体已删除以避免双份实现漂移。

// 从共享模块 re-export（顶部已 import _deleteR2Object，这里仅注释）
// 旧式 import 自本文件仍可工作；同时也支持直接 import 自 r2.js。

// ============ 主 Service ============

export class MusicService {
  constructor(db, env, waitUntil = null) {
    this.db = db
    this.env = env
  }

  // ---------- 通用：slug 生成 ----------

  async generateUniqueSlug(table) {
    for (let i = 0; i < 5; i++) {
      const slug = Math.random().toString(36).substring(2, 2 + SLIG_LEN)
      // 用 ? 占位避免 SQL 注入（虽然此处值受控）
      const existing = await this.db
        .prepare(`SELECT id FROM ${table} WHERE slug = ?`)
        .bind(slug)
        .first()
      if (!existing) return slug
    }
    throw new ValidationError('生成分享短码失败，请重试')
  }

  // ---------- 公开音频 URL ----------
  // 内部直接走共享 r2.js 的 buildR2PublicUrl；保留方法名 buildPublicUrl 不变
  // 以维持其他文件对 musicService 实例方法的调用。
  buildPublicUrl(r2Key) {
    return _buildR2PublicUrl(this.env, r2Key)
  }

  // ---------- 鉴权端点：歌曲 ----------

  async requestUploadUrl(uid, payload) {
    const filename = safeFilename(payload?.filename)
    const mimeType = typeof payload?.mimeType === 'string' ? payload.mimeType : ''
    const fileSize = Number(payload?.fileSize)
    const sha256 = String(payload?.sha256 || '').toLowerCase().trim()

    if (!ALLOWED_MIME.has(mimeType)) {
      throw new ValidationError(`不支持的音频格式：${mimeType || '(空)'}`)
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new ValidationError('文件大小不合法')
    }
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(`文件超过 ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB 上限`)
    }
    if (!SHA256_REGEX.test(sha256)) {
      throw new ValidationError('文件 SHA-256 不合法（需 64 位小写 hex）')
    }

    // ============ 1) per-user 查重 ============
    const existing = await this.db
      .prepare('SELECT * FROM music_songs WHERE uid = ? AND file_sha256 = ? LIMIT 1')
      .bind(uid, sha256)
      .first()
    if (existing) {
      return {
        exists: true,
        song: songMetaFromRow(existing, this.buildPublicUrl(existing.audio_r2_key)),
      }
    }

    // ============ 2) 统一存储额度预留（079 迁移起，不再走独立免费额度/积分按量计费）============
    const reservationId = await reserveStorage(this.db, uid, Math.floor(fileSize))
    if (!reservationId) {
      throw new ValidationError('存储空间不足，请先购买存储额度（1 积分 = 100MB）')
    }

    // ============ 3) 签 R2 URL ============
    const songId = crypto.randomUUID()
    const ext = EXT_BY_MIME[mimeType] || 'mp3'
    const r2Key = `songs/${uid}/${songId}.${ext}`

    const bucket = this.env.R2_BUCKET_NAME
    if (!bucket) throw new ValidationError('R2 桶名未配置（缺少 env.R2_BUCKET_NAME）')

    const { uploadUrl, expiresAt } = await _signR2PutUrl(this.env, bucket, r2Key, mimeType)

    return {
      exists: false,
      uploadUrl,
      r2Key,
      songId,
      expiresAt,
      publicUrl: this.buildPublicUrl(r2Key),
      reservationId,
    }
  }

  async createSong(uid, payload) {
    const r2Key = typeof payload?.r2Key === 'string' ? payload.r2Key.trim() : ''
    if (!r2Key.startsWith(`songs/${uid}/`)) {
      throw new ValidationError('r2Key 必须以 songs/{uid}/ 开头')
    }
    const mimeType = typeof payload?.mimeType === 'string' ? payload.mimeType : ''
    if (!ALLOWED_MIME.has(mimeType)) throw new ValidationError('不支持的音频格式')
    const fileSize = Number(payload?.fileSize)
    if (!Number.isFinite(fileSize) || fileSize <= 0) throw new ValidationError('文件大小不合法')
    const durationSec = finiteNum(payload?.durationSec)

    const title = str(payload?.title, MAX_TITLE, '未命名歌曲')
    if (!title) throw new ValidationError('标题不能为空')
    const artist = str(payload?.artist, MAX_ARTIST)
    const album = str(payload?.album, MAX_ALBUM)

    const sha256 = String(payload?.sha256 || '').toLowerCase().trim()
    if (!SHA256_REGEX.test(sha256)) {
      throw new ValidationError('文件 SHA-256 不合法')
    }
    // upload-url 时预扣存储额度返回的预留 id；缺省（旧客户端）则只按声明大小直接累计
    const reservationId = typeof payload?.reservationId === 'string' ? payload.reservationId.trim() : ''

    // 复用 pre-generated songId（前端在 upload-url 时已经分配），保持 R2 key 与 DB id 一致
    // 从 r2Key 提取 uuid 段
    const songId = r2Key.split('/').pop().split('.')[0]
    if (!/^[0-9a-f-]{36}$/i.test(songId)) {
      throw new ValidationError('songId 不合法')
    }

    // 二次查重：极端竞态下 upload-url 与 createSong 之间并发同 sha256 落地，
    // UNIQUE(uid, file_sha256) 会让第二次 INSERT 失败 → 释放预留 + 返回首次行
    const dupRow = await this.db
      .prepare('SELECT * FROM music_songs WHERE uid = ? AND file_sha256 = ? LIMIT 1')
      .bind(uid, sha256)
      .first()
    if (dupRow) {
      if (reservationId) {
        try { await releaseReservation(this.db, uid, reservationId) } catch (e) {
          console.error('[music-playlist] createSong dup releaseReservation failed:', e?.message || e)
        }
      }
      return songFromRow(dupRow)
    }

    const slug = await this.generateUniqueSlug('music_songs')
    const ts = now()

    try {
      await this.db
        .prepare(
          `INSERT INTO music_songs
             (id, uid, slug, title, artist, album, cover_r2_key, audio_r2_key, mime_type,
              file_size, duration_sec, is_public, play_count,
              credit_cost_paid, credit_tx_id, file_sha256, free_portion_bytes,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, 0, 0, NULL, ?, 0, ?, ?)`
        )
        .bind(songId, uid, slug, title, artist, album, r2Key, mimeType, fileSize,
          durationSec ?? null,
          sha256, ts, ts)
        .run()
    } catch (err) {
      const msg = err?.message || ''
      // UNIQUE 冲突兜底：捕获后查已存在的同行，做预留释放 + 返回
      if (/UNIQUE.*file_sha256/i.test(msg) || /uq_music_songs_uid_sha256/.test(msg)) {
        const existingRow = await this.db
          .prepare('SELECT * FROM music_songs WHERE uid = ? AND file_sha256 = ? LIMIT 1')
          .bind(uid, sha256)
          .first()
        if (existingRow) {
          if (reservationId) {
            try { await releaseReservation(this.db, uid, reservationId) } catch (e) {
              console.error('[music-playlist] createSong dup releaseReservation failed:', e?.message || e)
            }
          }
          return songFromRow(existingRow)
        }
      }
      throw err
    }

    // 结算统一存储额度：以 R2 真实大小为准（HEAD 失败回退声明值），并释放预留
    try {
      const bucket = this.env.R2_BUCKET_NAME
      const headSize = bucket ? await _headR2ObjectSize(this.env, bucket, r2Key).catch(() => null) : null
      const actualSize = headSize ?? Math.max(0, Math.floor(fileSize))
      await settleReservation(this.db, uid, reservationId, actualSize)
    } catch (e) {
      console.error('[music-playlist] createSong settleReservation failed:', e?.message || e)
    }

    const row = await this.findOwnedSongRow(songId, uid)
    return songFromRow(row)
  }

  async listMySongs(uid, { page = 1, pageSize = 20, keyword = '' } = {}) {
    const offset = (page - 1) * pageSize
    let whereSql = 'WHERE uid = ?'
    const params = [uid]
    if (keyword) {
      whereSql += ' AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)'
      const kw = `%${keyword}%`
      params.push(kw, kw, kw)
    }
    const countRow = await this.db
      .prepare(`SELECT COUNT(*) AS total FROM music_songs ${whereSql}`)
      .bind(...params)
      .first()
    const { results } = await this.db
      .prepare(`SELECT * FROM music_songs ${whereSql} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
      .bind(...params, pageSize, offset)
      .all()
    return {
      list: (results || []).map((r) => songMetaFromRow(r, this.buildPublicUrl(r.audio_r2_key))),
      total: countRow?.total ?? 0,
    }
  }

  async findOwnedSongRow(id, uid) {
    return await this.db
      .prepare('SELECT * FROM music_songs WHERE id = ? AND uid = ?')
      .bind(id, uid)
      .first()
  }

  async getSongForOwner(id, uid) {
    const row = await this.findOwnedSongRow(id, uid)
    if (!row) return null
    const song = songFromRow(row)
    // 关联歌单
    const { results } = await this.db
      .prepare(
        `SELECT pl.id, pl.title, pl.slug
         FROM music_playlists pl
         JOIN music_playlist_songs ps ON ps.playlist_id = pl.id
         WHERE ps.song_id = ?`
      )
      .bind(id)
      .all()
    return { ...song, playlists: results || [] }
  }

  async updateSong(id, uid, payload) {
    const row = await this.findOwnedSongRow(id, uid)
    if (!row) return null
    const title = str(payload?.title, MAX_TITLE)
    const artist = str(payload?.artist, MAX_ARTIST)
    const album = str(payload?.album, MAX_ALBUM)
    const isPublic = typeof payload?.isPublic === 'boolean'
      ? Number(payload.isPublic)
      : row.is_public
    const ts = now()
    await this.db
      .prepare(
        `UPDATE music_songs
           SET title = COALESCE(?, title),
               artist = COALESCE(?, artist),
               album = COALESCE(?, album),
               is_public = ?,
               updated_at = ?
           WHERE id = ? AND uid = ?`
      )
      .bind(title || null, artist || null, album || null, isPublic, ts, id, uid)
      .run()
    return this.getSongForOwner(id, uid)
  }

  async deleteSong(id, uid) {
    const row = await this.findOwnedSongRow(id, uid)
    if (!row) return false

    // 退回统一存储额度（按落库的 file_size；积分不退）
    const bytesToRefund = Math.max(0, Number(row.file_size) || 0)
    if (bytesToRefund > 0) {
      try {
        await refundStorageUsage(this.db, uid, bytesToRefund)
      } catch (err) {
        // 额度退回失败不阻塞删歌
        console.error('[music-playlist] deleteSong refundStorageUsage failed (continuing):', err?.message || err)
      }
    }

    // join 行靠 ON DELETE CASCADE 自动清；这里只删主表 + R2 对象
    const stmts = [
      this.db.prepare('DELETE FROM music_songs WHERE id = ? AND uid = ?').bind(id, uid),
    ]
    await this.db.batch(stmts)

    // R2 对象删除（走 SigV4，与上传同 bucket；best-effort，失败仅记日志，不影响主流程）
    const bucket = this.env.R2_BUCKET_NAME
    try {
      if (bucket && row.audio_r2_key) {
        await _deleteR2Object(this.env, bucket, row.audio_r2_key)
      }
      if (bucket && row.cover_r2_key) {
        await _deleteR2Object(this.env, bucket, row.cover_r2_key)
      }
    } catch (error) {
      console.error('R2 delete object failed:', error)
    }

    // 重新计算受影响的歌单 song_count（FK CASCADE 已删 join 行，count 可能脏）
    // 找出所有曾包含此 song 的 playlist_id（CASCADE 已删，所以现在查不到）→ 用受影响 playlists 重新聚合
    // 简化：基于全部 playlist 全表 recompute（数据量小，可接受）
    const { results: playlists } = await this.db
      .prepare('SELECT id FROM music_playlists WHERE uid = ?')
      .bind(uid)
      .all()
    if (playlists && playlists.length) {
      const recomputeStmts = playlists.map((p) => this.db
        .prepare(
          `UPDATE music_playlists
             SET song_count = (SELECT COUNT(*) FROM music_playlist_songs WHERE playlist_id = ?),
                 updated_at = ?
             WHERE id = ?`
        )
        .bind(p.id, now(), p.id))
      try { await this.db.batch(recomputeStmts) } catch (e) { console.error('recompute song_count failed:', e) }
    }

    return true
  }

  async incrementSongPlayCount(id) {
    await this.db
      .prepare('UPDATE music_songs SET play_count = play_count + 1 WHERE id = ?')
      .bind(id)
      .run()
    const row = await this.db
      .prepare('SELECT play_count FROM music_songs WHERE id = ?')
      .bind(id)
      .first()
    return row?.play_count ?? 0
  }

  async incrementPlayCountBySlug(slug) {
    // 先检查歌曲存在 + 公开
    const row = await this.db
      .prepare('SELECT id FROM music_songs WHERE slug = ? AND is_public = 1')
      .bind(slug)
      .first()
    if (!row) return null
    const playCount = await this.incrementSongPlayCount(row.id)
    return playCount
  }

  // ---------- 鉴权端点：歌单 ----------

  async listMyPlaylists(uid, { page = 1, pageSize = 20 } = {}) {
    const offset = (page - 1) * pageSize
    const countRow = await this.db
      .prepare('SELECT COUNT(*) AS total FROM music_playlists WHERE uid = ?')
      .bind(uid)
      .first()
    const { results } = await this.db
      .prepare(
        `SELECT * FROM music_playlists WHERE uid = ?
         ORDER BY updated_at DESC LIMIT ? OFFSET ?`
      )
      .bind(uid, pageSize, offset)
      .all()
    return {
      list: (results || []).map(playlistMetaFromRow),
      total: countRow?.total ?? 0,
    }
  }

  async findOwnedPlaylistRow(id, uid) {
    return await this.db
      .prepare('SELECT * FROM music_playlists WHERE id = ? AND uid = ?')
      .bind(id, uid)
      .first()
  }

  async getPlaylistForOwner(id, uid) {
    const row = await this.findOwnedPlaylistRow(id, uid)
    if (!row) return null
    return { ...playlistFromRow(row), songs: await this.loadPlaylistSongs(id) }
  }

  async loadPlaylistSongs(playlistId) {
    const { results } = await this.db
      .prepare(
        `SELECT s.* FROM music_songs s
         JOIN music_playlist_songs ps ON ps.song_id = s.id
         WHERE ps.playlist_id = ?
         ORDER BY ps.sort_order ASC, ps.added_at ASC`
      )
      .bind(playlistId)
      .all()
    return (results || []).map((r) => songMetaFromRow(r, this.buildPublicUrl(r.audio_r2_key)))
  }

  async createPlaylist(uid, payload) {
    const title = str(payload?.title, MAX_TITLE, '我的歌单')
    if (!title) throw new ValidationError('标题不能为空')
    const description = str(payload?.description, MAX_DESCRIPTION)
    const isPublic = payload?.isPublic === true ? 1 : 0
    const songIds = Array.isArray(payload?.songIds) ? payload.songIds.filter((x) => typeof x === 'string') : []

    const id = crypto.randomUUID()
    const slug = await this.generateUniqueSlug('music_playlists')
    const ts = now()

    const stmts = [
      this.db
        .prepare(
          `INSERT INTO music_playlists
             (id, uid, slug, title, description, is_public, view_count, song_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
        )
        .bind(id, uid, slug, title, description, isPublic, ts, ts),
    ]

    // 校验 songIds 归属当前用户
    if (songIds.length > MAX_PLAYLIST_SONGS) {
      throw new ValidationError(`歌单最多 ${MAX_PLAYLIST_SONGS} 首歌曲`)
    }
    let verifiedSongIds = []
    if (songIds.length) {
      const placeholders = songIds.map(() => '?').join(', ')
      const { results } = await this.db
        .prepare(`SELECT id FROM music_songs WHERE uid = ? AND id IN (${placeholders})`)
        .bind(uid, ...songIds)
        .all()
      verifiedSongIds = (results || []).map((r) => r.id)
      for (let i = 0; i < verifiedSongIds.length; i++) {
        stmts.push(this.db
          .prepare(
            `INSERT INTO music_playlist_songs (playlist_id, song_id, sort_order, added_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(id, verifiedSongIds[i], i, ts))
      }
      if (verifiedSongIds.length) {
        stmts.push(this.db
          .prepare(`UPDATE music_playlists SET song_count = ?, updated_at = ? WHERE id = ?`)
          .bind(verifiedSongIds.length, ts, id))
      }
    }

    await this.db.batch(stmts)
    return this.getPlaylistForOwner(id, uid)
  }

  async updatePlaylist(id, uid, payload) {
    const row = await this.findOwnedPlaylistRow(id, uid)
    if (!row) return null
    const title = str(payload?.title, MAX_TITLE)
    const description = str(payload?.description, MAX_DESCRIPTION)
    const isPublic = typeof payload?.isPublic === 'boolean'
      ? Number(payload.isPublic)
      : row.is_public

    const ts = now()
    const stmts = [
      this.db
        .prepare(
          `UPDATE music_playlists
             SET title = COALESCE(?, title),
                 description = COALESCE(?, description),
                 is_public = ?,
                 updated_at = ?
             WHERE id = ? AND uid = ?`
        )
        .bind(title || null, description || null, isPublic, ts, id, uid),
    ]

    // addSongIds / removeSongIds / reorder
    const addSongIds = Array.isArray(payload?.addSongIds) ? payload.addSongIds : []
    const removeSongIds = Array.isArray(payload?.removeSongIds) ? payload.removeSongIds : []
    const reorder = Array.isArray(payload?.reorder) ? payload.reorder : []

    if (addSongIds.length) {
      const placeholders = addSongIds.map(() => '?').join(', ')
      const { results } = await this.db
        .prepare(`SELECT id FROM music_songs WHERE uid = ? AND id IN (${placeholders})`)
        .bind(uid, ...addSongIds)
        .all()
      const verified = (results || []).map((r) => r.id)
      // 取得当前最大 sort_order，新加入的接续其后
      const maxOrderRow = await this.db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM music_playlist_songs WHERE playlist_id = ?')
        .bind(id)
        .first()
      let sortOrder = (maxOrderRow?.m ?? -1) + 1
      for (const sid of verified) {
        // INSERT OR IGNORE 防止重复加入
        stmts.push(this.db
          .prepare(
            `INSERT OR IGNORE INTO music_playlist_songs (playlist_id, song_id, sort_order, added_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(id, sid, sortOrder++, ts))
      }
    }

    if (removeSongIds.length) {
      const placeholders = removeSongIds.map(() => '?').join(', ')
      stmts.push(this.db
        .prepare(`DELETE FROM music_playlist_songs WHERE playlist_id = ? AND song_id IN (${placeholders})`)
        .bind(id, ...removeSongIds))
    }

    if (reorder.length) {
      for (const item of reorder) {
        if (!item?.songId) continue
        const order = Number(item.sortOrder)
        if (!Number.isFinite(order)) continue
        stmts.push(this.db
          .prepare(`UPDATE music_playlist_songs SET sort_order = ? WHERE playlist_id = ? AND song_id = ?`)
          .bind(order, id, item.songId))
      }
    }

    // 只要 join 行变化就重算 song_count（SELECT COUNT 一次）
    if (addSongIds.length || removeSongIds.length || reorder.length) {
      stmts.push(this.db
        .prepare(
          `UPDATE music_playlists
             SET song_count = (SELECT COUNT(*) FROM music_playlist_songs WHERE playlist_id = ?),
                 updated_at = ?
             WHERE id = ?`
        )
        .bind(id, ts, id))
    }

    await this.db.batch(stmts)
    return this.getPlaylistForOwner(id, uid)
  }

  async deletePlaylist(id, uid) {
    const row = await this.findOwnedPlaylistRow(id, uid)
    if (!row) return false
    // join 行靠 CASCADE 自动清
    await this.db
      .prepare('DELETE FROM music_playlists WHERE id = ? AND uid = ?')
      .bind(id, uid)
      .run()
    return true
  }

  // ---------- 公开分享 ----------

  async getPublicSongBySlug(slug) {
    const row = await this.db
      .prepare(
        `SELECT s.*, u.username AS author_name, u.avatar AS author_avatar
         FROM music_songs s
         LEFT JOIN user u ON u.id = s.uid
         WHERE s.slug = ? AND s.is_public = 1`
      )
      .bind(slug)
      .first()
    if (!row) return null

    // play_count 自增
    try {
      await this.db
        .prepare('UPDATE music_songs SET play_count = play_count + 1 WHERE id = ?')
        .bind(row.id)
        .run()
    } catch (error) {
      console.error('music song play_count update failed:', error)
    }

    return {
      slug: row.slug,
      title: row.title,
      artist: row.artist || '',
      album: row.album || '',
      durationSec: row.duration_sec === null || row.duration_sec === undefined ? null : row.duration_sec,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      playCount: row.play_count + 1,
      publicAudioUrl: this.buildPublicUrl(row.audio_r2_key),
      createdAt: row.created_at,
      author: {
        name: row.author_name || '匿名用户',
        avatar: row.author_avatar || '',
      },
    }
  }

  async getPublicPlaylistBySlug(slug) {
    const row = await this.db
      .prepare(
        `SELECT pl.*, u.username AS author_name, u.avatar AS author_avatar
         FROM music_playlists pl
         LEFT JOIN user u ON u.id = pl.uid
         WHERE pl.slug = ? AND pl.is_public = 1`
      )
      .bind(slug)
      .first()
    if (!row) return null

    // view_count 自增
    try {
      await this.db
        .prepare('UPDATE music_playlists SET view_count = view_count + 1 WHERE id = ?')
        .bind(row.id)
        .run()
    } catch (error) {
      console.error('music playlist view_count update failed:', error)
    }

    // 关联歌曲（只展示公开的）
    const { results } = await this.db
      .prepare(
        `SELECT s.id, s.slug, s.title, s.artist, s.album, s.duration_sec,
                s.mime_type, s.file_size, s.play_count, s.is_public,
                s.audio_r2_key, s.updated_at
         FROM music_songs s
         JOIN music_playlist_songs ps ON ps.song_id = s.id
         WHERE ps.playlist_id = ? AND s.is_public = 1
         ORDER BY ps.sort_order ASC, ps.added_at ASC`
      )
      .bind(row.id)
      .all()

    return {
      slug: row.slug,
      title: row.title,
      description: row.description || '',
      viewCount: row.view_count + 1,
      songCount: row.song_count,
      createdAt: row.created_at,
      author: {
        name: row.author_name || '匿名用户',
        avatar: row.author_avatar || '',
      },
      songs: (results || []).map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        artist: s.artist || '',
        album: s.album || '',
        durationSec: s.duration_sec === null || s.duration_sec === undefined ? null : s.duration_sec,
        mimeType: s.mime_type,
        fileSize: s.file_size,
        playCount: s.play_count,
        isPublic: s.is_public === 1,
        publicAudioUrl: this.buildPublicUrl(s.audio_r2_key),
        updatedAt: s.updated_at,
      })),
    }
  }
}

export { ValidationError }