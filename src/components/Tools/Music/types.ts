// 与 functions/services/musicService.js 字段命名保持一致（camelCase）

export interface Song {
  id: string
  uid: string
  slug: string
  title: string
  artist: string
  album: string
  coverR2Key: string | null
  audioR2Key: string
  mimeType: string
  fileSize: number
  durationSec: number | null
  isPublic: boolean
  playCount: number
  createdAt: string
  updatedAt: string
}

/** 列表/管理页轻量字段（不含 audioR2Key 等） */
export interface SongMeta {
  id: string
  slug: string
  title: string
  artist: string
  album: string
  durationSec: number | null
  isPublic: boolean
  playCount: number
  /** R2 公开读地址（前端 <audio src> 直用）；未配置 R2_PUBLIC_HOST 时为空字符串 */
  playUrl: string
  updatedAt: string
}

export interface SongDetail extends Song {
  playlists: Array<{ id: string; title: string; slug: string }>
}

export interface Playlist {
  id: string
  uid: string
  slug: string
  title: string
  description: string
  isPublic: boolean
  viewCount: number
  songCount: number
  createdAt: string
  updatedAt: string
}

export interface PlaylistMeta {
  id: string
  slug: string
  title: string
  description: string
  isPublic: boolean
  viewCount: number
  songCount: number
  updatedAt: string
}

export interface PlaylistDetail extends Playlist {
  songs: SongMeta[]
}

/** POST /songs/upload-url 返回 */
export interface UploadUrlResponse {
  uploadUrl: string
  r2Key: string
  songId: string
  expiresAt: number
  publicUrl: string
  /** 上传扣费积分 */
  cost: number
  /** 关联 deduct 流水的 txId；后续可走 /songs/{txId}/reverse 反向冲销 */
  txId: string
  /** 扣费后的余额 */
  balanceAfter: number
}

/** POST /songs/upload-url 当 SHA-256 已存在时返回 exists 分支 */
export interface UploadUrlExistingResponse {
  exists: true
  song: SongMeta
}

/** POST /songs/upload-url 当 SHA-256 不存在时返回 exists:false 分支 */
export interface UploadUrlNewResponse {
  exists: false
  uploadUrl: string
  r2Key: string
  songId: string
  expiresAt: number
  publicUrl: string
  cost: number
  txId: string
  balanceAfter: number
  /** 本次消耗的免费额度字节（min(fileSize, freeRemaining)；单文件独立计费） */
  freePortionBytes?: number
}

/** 上传前的 cost 预览（GET /songs/quote）—— 按批次合计 */
export interface QuoteResponse {
  sizes: number[]
  totalSize: number
  /** 本次将扣除的积分（仅按付费字节计算，免费部分不计） */
  totalCost: number
  /** 本批次中走免费额度的字节数 */
  freeBytes: number
  /** 本批次中走积分的字节数（已扣免费额度之后） */
  paidBytes: number
  /** 用户当前已用的免费额度字节 */
  freeQuotaUsed: number
  /** 用户终身免费额度上限字节 */
  freeQuotaTotal: number
  balance: number
  /** 计费比例：多少 MB = 1 积分 */
  mbPerCredit: number
  /** 单文件大小上限（字节）—— 由后端返回，前端不做兜底硬编码 */
  maxFileSizeBytes: number
}

/** 分页元信息（与 functions/utils/db.js 的 Pager.createResult 对齐） */
export interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PagedResponse<T> {
  data: T[]
  pagination: Pagination
}

/** 公开分享页：歌曲 */
export interface PublicSong {
  slug: string
  title: string
  artist: string
  album: string
  durationSec: number | null
  mimeType: string
  fileSize: number
  playCount: number
  publicAudioUrl: string
  createdAt: string
  author: { name: string; avatar: string }
}

/** 公开分享页：歌单内单首歌曲（公开分享页内歌曲简版，无 createdAt / author） */
export interface PublicPlaylistSong {
  id: string
  slug: string
  title: string
  artist: string
  album: string
  durationSec: number | null
  mimeType: string
  fileSize: number
  playCount: number
  isPublic: boolean
  publicAudioUrl: string
  updatedAt: string
}

/** 公开分享页：歌单 */
export interface PublicPlaylist {
  slug: string
  title: string
  description: string
  viewCount: number
  songCount: number
  createdAt: string
  author: { name: string; avatar: string }
  songs: PublicPlaylistSong[]
}