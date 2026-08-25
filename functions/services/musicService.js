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

const enc = new TextEncoder()

function toHex(buffer) {
  const bytes = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

async function hmac(key, data) {
  // key: ArrayBuffer | Uint8Array | string; data: string
  let keyBuf
  if (typeof key === 'string') {
    keyBuf = enc.encode(key)
  } else if (key instanceof Uint8Array) {
    keyBuf = key
  } else {
    keyBuf = new Uint8Array(key)
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  // 注意：HMAC key 的 sign 算法必须是 'HMAC'（hash 已在 importKey 里指定），
  // 不能传 'SHA-256'，否则报 InvalidAccessError: algorithm mismatch
  return await crypto.subtle.sign({ name: 'HMAC' }, cryptoKey, enc.encode(data))
}

async function sha256Hex(data) {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(data))
  return toHex(hash)
}

// URI 编码（RFC 3986 严格模式：~ 不编码）
function uriEncode(value, encodeSlash = true) {
  let str = String(value)
  // 先 encodeURIComponent 一次，再把 ! ~ * ' ( ) 还原，最后把 %7E 还原为 ~
  str = encodeURIComponent(str)
  str = str.replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')
  str = str.replace(/%7E/g, '~')
  if (!encodeSlash) str = str.replace(/%2F/g, '/')
  return str
}

// 关键 → S3 path-style 编码。每个路径段单独编码后用 / 连接
function encodeS3Key(key) {
  return key.split('/').map((seg) => uriEncode(seg, true)).join('/')
}

/**
 * 签发 R2 预签名 PUT URL
 * @param env: Cloudflare Pages env，需含 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID / MEDIA (binding)
 * @param bucket R2 桶名（从 binding 配置读取；这里直接传 env.MEDIA 默认桶较麻烦，直接用 toml 中的桶名）
 * @param r2Key 对象键（如 songs/uid/id.mp3）
 * @param contentType MIME 类型
 */
export async function signR2PutUrl(env, bucket, r2Key, contentType) {
  const accessKeyId = env.R2_ACCESS_KEY_ID
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY
  const accountId = env.R2_ACCOUNT_ID
  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new ValidationError('R2 凭据未配置（缺少 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID）')
  }
  if (!bucket) throw new ValidationError('R2 桶名未配置（wrangler.toml [[r2_buckets]] binding）')

  // 时间戳
  const nowDate = new Date()
  const amzDate = nowDate.toISOString().replace(/[:-]|\.\d{3}/g, '') // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.substring(0, 8) // YYYYMMDD

  // endpoint（账户级域名；区域 R2 自动就近）
  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`
  const encodedKey = encodeS3Key(r2Key)
  const canonicalUri = `/${encodedKey}`

  // service: s3, region: auto
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`

  // signedHeaders 必须与下方 canonicalHeaders / signedHeaders 变量保持一致
  // 这里要签两个：host（浏览器自动加）+ content-type（XHR 显式加）
  const signedHeaders = 'content-type;host'

  // query 参数（按字典序）
  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(PRESIGN_EXPIRES_SECONDS),
    'X-Amz-SignedHeaders': signedHeaders,
  })
  // 严格按 SigV4：query 必须字典序排序（URLSearchParams.toString 已经按插入顺序，不保证字典序）
  const sortedQuery = [...queryParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .join('&')

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`
  const payloadHash = 'UNSIGNED-PAYLOAD'

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    sortedQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  // 计算签名：kDate → kRegion(auto) → kService(s3) → kSigning
  const kSecret = enc.encode(`AWS4${secretAccessKey}`)
  const kDate = await hmac(kSecret, dateStamp)
  const kRegion = await hmac(kDate, 'auto')
  const kService = await hmac(kRegion, 's3')
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = toHex(await hmac(kSigning, stringToSign))

  const uploadUrl = `https://${host}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${signature}`

  // 计算过期时间（绝对时间戳 ms）
  const expiresAt = nowDate.getTime() + PRESIGN_EXPIRES_SECONDS * 1000

  return { uploadUrl, r2Key, expiresAt }
}

/**
 * 服务端用 SigV4 直接删 R2 对象（不走 binding，避免 preview bucket 不一致）
 * 与 signR2PutUrl 保持同一组 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID
 */
async function deleteR2Object(env, bucket, r2Key) {
  const accessKeyId = env.R2_ACCESS_KEY_ID
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY
  const accountId = env.R2_ACCOUNT_ID
  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error('R2 凭据未配置（缺少 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID）')
  }
  if (!bucket) throw new Error('R2 桶名未配置（缺少 env.R2_BUCKET_NAME）')

  const nowDate = new Date()
  const amzDate = nowDate.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.substring(0, 8)
  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`
  const canonicalUri = `/${encodeS3Key(r2Key)}`
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`

  // DELETE 无 body，只需签 host；payload 走 UNSIGNED-PAYLOAD
  // ⚠️ 不要再手动加任何 header（如 x-amz-content-sha256），
  // Cloudflare Workers fetch 转发 DELETE 请求时，会把请求里出现的 header
  // 都纳入签名计算；没签进 signedHeaders 就加 header 会导致 R2 端 SignatureDoesNotMatch
  const signedHeaders = 'host'
  const canonicalHeaders = `host:${host}\n`
  const payloadHash = 'UNSIGNED-PAYLOAD'

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': '300',
    'X-Amz-SignedHeaders': signedHeaders,
  })
  const sortedQuery = [...queryParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .join('&')

  const canonicalRequest = [
    'DELETE',
    canonicalUri,
    sortedQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const kSecret = enc.encode(`AWS4${secretAccessKey}`)
  const kDate = await hmac(kSecret, dateStamp)
  const kRegion = await hmac(kDate, 'auto')
  const kService = await hmac(kRegion, 's3')
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = toHex(await hmac(kSigning, stringToSign))

  const url = `https://${host}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${signature}`
  const response = await fetch(url, {
    method: 'DELETE',
  })

  // 204 = 成功，404 = 已不存在（视为成功，幂等）
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '')
    throw new Error(`R2 delete 失败: HTTP ${response.status} ${text}`)
  }
}

// ============ 主 Service ============

export class MusicService {
  constructor(db, env) {
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

  buildPublicUrl(r2Key) {
    const host = this.env.R2_PUBLIC_HOST || PUBLIC_HOST_FALLBACK
    if (!host) return ''
    return `https://${host}/${r2Key.split('/').map((s) => encodeURIComponent(s)).join('/')}`
  }

  // ---------- 鉴权端点：歌曲 ----------

  async requestUploadUrl(uid, payload) {
    const filename = safeFilename(payload?.filename)
    const mimeType = typeof payload?.mimeType === 'string' ? payload.mimeType : ''
    const fileSize = Number(payload?.fileSize)

    if (!ALLOWED_MIME.has(mimeType)) {
      throw new ValidationError(`不支持的音频格式：${mimeType || '(空)'}`)
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new ValidationError('文件大小不合法')
    }
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(`文件超过 ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB 上限`)
    }

    const songId = crypto.randomUUID()
    const ext = EXT_BY_MIME[mimeType] || 'mp3'
    const r2Key = `songs/${uid}/${songId}.${ext}`

    // 桶名从 binding meta 拿不到（无 .bucketName），所以从 env 显式配置
    const bucket = this.env.R2_BUCKET_NAME
    if (!bucket) throw new ValidationError('R2 桶名未配置（缺少 env.R2_BUCKET_NAME）')

    const { uploadUrl, expiresAt } = await signR2PutUrl(this.env, bucket, r2Key, mimeType)

  // 临时调试：确认函数 env 实际拿到的凭据和签发结果
  // （wrangler 4.59.2 有 .dev.vars 不注入函数 env 的 bug，debug 用一次后可移除）
  console.log('[music debug] accessKey first 8:', String(this.env.R2_ACCESS_KEY_ID || '').slice(0, 8))
  console.log('[music debug] secret length:', String(this.env.R2_SECRET_ACCESS_KEY || '').length)
  console.log('[music debug] accountId:', this.env.R2_ACCOUNT_ID)
  console.log('[music debug] SignedHeaders in URL:', (uploadUrl.match(/X-Amz-SignedHeaders=([^&]+)/) || [])[1])

    return {
      uploadUrl,
      r2Key,
      songId,
      expiresAt,
      publicUrl: this.buildPublicUrl(r2Key),
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

    // 复用 pre-generated songId（前端在 upload-url 时已经分配），保持 R2 key 与 DB id 一致
    // 从 r2Key 提取 uuid 段
    const songId = r2Key.split('/').pop().split('.')[0]
    if (!/^[0-9a-f-]{36}$/i.test(songId)) {
      throw new ValidationError('songId 不合法')
    }

    const slug = await this.generateUniqueSlug('music_songs')
    const ts = now()

    await this.db
      .prepare(
        `INSERT INTO music_songs
           (id, uid, slug, title, artist, album, cover_r2_key, audio_r2_key, mime_type,
            file_size, duration_sec, is_public, play_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, 0, ?, ?)`
      )
      .bind(songId, uid, slug, title, artist, album, r2Key, mimeType, fileSize,
        durationSec ?? null, ts, ts)
      .run()

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

    // join 行靠 ON DELETE CASCADE 自动清；这里只删主表 + R2 对象
    const stmts = [
      this.db.prepare('DELETE FROM music_songs WHERE id = ? AND uid = ?').bind(id, uid),
    ]
    await this.db.batch(stmts)

    // R2 对象删除（走 SigV4，与上传同 bucket；best-effort，失败仅记日志，不影响主流程）
    const bucket = this.env.R2_BUCKET_NAME
    try {
      if (bucket && row.audio_r2_key) {
        await deleteR2Object(this.env, bucket, row.audio_r2_key)
      }
      if (bucket && row.cover_r2_key) {
        await deleteR2Object(this.env, bucket, row.cover_r2_key)
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