import { functionsRequest } from '@/utils/functionsRequest'
import type {
  Song,
  SongMeta,
  SongDetail,
  PlaylistMeta,
  PlaylistDetail,
  UploadUrlExistingResponse,
  UploadUrlNewResponse,
  QuoteResponse,
  PublicSong,
  PublicPlaylist,
  PagedResponse,
  Pagination,
} from '@/components/Tools/Music/types'

/** requestUploadUrl 返回（discriminated union：exists 分支 vs 正常分支） */
export type RequestUploadUrlResult = UploadUrlExistingResponse | UploadUrlNewResponse

const EMPTY_PAGINATION: Pagination = {
  total: 0, page: 1, pageSize: 20, totalPages: 0, hasNext: false, hasPrev: false,
}

// ============ 鉴权 API ============

/** 上传前的 cost 预览（不扣费，仅算账 + 拿余额）。fileSize 单位：字节 */
export async function quoteUpload(fileSizes: number[]): Promise<QuoteResponse> {
  const params = new URLSearchParams()
  for (const s of fileSizes) params.append('fileSizes', String(s))
  const res = await functionsRequest.get(`/api/music-playlist/songs/quote?${params.toString()}`)
  return res.data as QuoteResponse
}

/** 申请 SigV4 预签名 PUT URL（用于浏览器直传 R2）
 * - 同一用户 SHA-256 命中已有歌曲 → 返回 { exists: true, song }，不扣费，不签 URL
 * - 新文件 → 每文件独立计费（含免费额度拆分）：先走免费额度，剩余部分按 2MB/积分
 * - 返回的 txId 可在上传失败时通过 reverseUpload 反向冲销（积分 + 免费额度同时退还） */
export async function requestUploadUrl(payload: {
  filename: string
  mimeType: string
  fileSize: number
  sha256: string
  idempotencyKey?: string
}): Promise<RequestUploadUrlResult> {
  const res = await functionsRequest.post('/api/music-playlist/songs/upload-url', payload)
  return res.data as RequestUploadUrlResult
}

/** 创建歌曲元数据（R2 上传成功后调用）
 * - sha256/creditCostPaid/creditTxId/freePortionBytes 由 requestUploadUrl 返回或前端持有 */
export async function createSong(payload: {
  title: string
  artist?: string
  album?: string
  r2Key: string
  mimeType: string
  fileSize: number
  durationSec?: number | null
  sha256: string
  creditCostPaid: number
  creditTxId: string
  /** 本首歌消耗的免费额度字节（payer 名下整批 freeBytes；后续首 = 0） */
  freePortionBytes?: number
}): Promise<Song> {
  const res = await functionsRequest.post('/api/music-playlist/songs', payload)
  return res.data as Song
}

/** 上传失败时反向冲销扣费（type='reverse'，不走 deleteSong 的 type='refund'） */
export async function reverseUpload(txId: string): Promise<{ reversed: boolean; amount: number }> {
  const res = await functionsRequest.post(`/api/music-playlist/songs/${encodeURIComponent(txId)}/reverse`)
  return res.data as { reversed: boolean; amount: number; txId: string }
}

export interface ListSongsParams { page?: number; pageSize?: number; keyword?: string }

export async function listMySongs(params: ListSongsParams = {}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const res = await functionsRequest.get('/api/music-playlist/songs', {
    params: { page, pageSize, keyword: params.keyword || undefined },
  })
  const body = res.data as PagedResponse<SongMeta>
  return {
    list: body?.data ?? [],
    pagination: body?.pagination ?? { ...EMPTY_PAGINATION, page, pageSize },
  }
}

export async function getSong(id: string): Promise<SongDetail> {
  const res = await functionsRequest.get(`/api/music-playlist/songs/${id}`)
  return res.data as SongDetail
}

export async function updateSong(
  id: string,
  payload: { title?: string; artist?: string; album?: string; isPublic?: boolean }
): Promise<SongDetail> {
  const res = await functionsRequest.patch(`/api/music-playlist/songs/${id}`, payload)
  return res.data as SongDetail
}

export async function deleteSong(id: string): Promise<void> {
  await functionsRequest.delete(`/api/music-playlist/songs/${id}`)
}

/** 拥有者自己播放也计 +1（对应 POST /api/music-playlist/songs/{id}/play） */
export async function postMySongPlay(id: string): Promise<{ playCount: number } | null> {
  try {
    const res = await functionsRequest.post(`/api/music-playlist/songs/${id}/play`)
    return { playCount: res.data?.playCount ?? 0 }
  } catch {
    return null
  }
}

export async function listMyPlaylists(params: { page?: number; pageSize?: number } = {}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const res = await functionsRequest.get('/api/music-playlist/playlists', {
    params: { page, pageSize },
  })
  const body = res.data as PagedResponse<PlaylistMeta>
  return {
    list: body?.data ?? [],
    pagination: body?.pagination ?? { ...EMPTY_PAGINATION, page, pageSize },
  }
}

export async function createPlaylist(payload: {
  title: string
  description?: string
  isPublic?: boolean
  songIds?: string[]
}): Promise<PlaylistDetail> {
  const res = await functionsRequest.post('/api/music-playlist/playlists', payload)
  return res.data as PlaylistDetail
}

export async function getPlaylist(id: string): Promise<PlaylistDetail> {
  const res = await functionsRequest.get(`/api/music-playlist/playlists/${id}`)
  return res.data as PlaylistDetail
}

export async function updatePlaylist(
  id: string,
  payload: {
    title?: string
    description?: string
    isPublic?: boolean
    addSongIds?: string[]
    removeSongIds?: string[]
    reorder?: Array<{ songId: string; sortOrder: number }>
  }
): Promise<PlaylistDetail> {
  const res = await functionsRequest.patch(`/api/music-playlist/playlists/${id}`, payload)
  return res.data as PlaylistDetail
}

export async function deletePlaylist(id: string): Promise<void> {
  await functionsRequest.delete(`/api/music-playlist/playlists/${id}`)
}

// ============ 公开分享 API（用原生 fetch 避开 404 拦截器） ============

export type SharedSongResult =
  | { ok: true; data: PublicSong }
  | { ok: false; reason: 'not-found' | 'error'; message: string }

export async function fetchSharedSong(slug: string): Promise<SharedSongResult> {
  try {
    const res = await fetch(`/api/music-playlist/song/${encodeURIComponent(slug)}`)
    if (res.status === 404) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, reason: 'not-found', message: body?.error || '歌曲不存在或已关闭分享' }
    }
    if (!res.ok) return { ok: false, reason: 'error', message: '加载失败，请稍后重试' }
    return { ok: true, data: (await res.json()) as PublicSong }
  } catch {
    return { ok: false, reason: 'error', message: '网络连接失败，请稍后重试' }
  }
}

export async function postSharedSongPlay(slug: string): Promise<{ playCount: number } | null> {
  try {
    const res = await fetch(`/api/music-playlist/song/${encodeURIComponent(slug)}/play`, {
      method: 'POST',
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    const body = await res.json()
    return { playCount: body?.playCount ?? 0 }
  } catch {
    return null
  }
}

export type SharedPlaylistResult =
  | { ok: true; data: PublicPlaylist }
  | { ok: false; reason: 'not-found' | 'error'; message: string }

export async function fetchSharedPlaylist(slug: string): Promise<SharedPlaylistResult> {
  try {
    const res = await fetch(`/api/music-playlist/playlist/${encodeURIComponent(slug)}`)
    if (res.status === 404) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, reason: 'not-found', message: body?.error || '歌单不存在或已关闭分享' }
    }
    if (!res.ok) return { ok: false, reason: 'error', message: '加载失败，请稍后重试' }
    return { ok: true, data: (await res.json()) as PublicPlaylist }
  } catch {
    return { ok: false, reason: 'error', message: '网络连接失败，请稍后重试' }
  }
}

// ============ XHR 直传 R2（fetch PUT 无法暴露进度，必须用 XMLHttpRequest） ============

export interface UploadProgress {
  loaded: number
  total: number
}

/**
 * 通过预签名 URL 直接把文件 PUT 到 R2，进度通过回调返回。
 * 返回最终的 R2 响应；非 200 抛错由调用方处理。
 */
export function xhrPutToR2(
  url: string,
  file: Blob,
  contentType: string,
  onProgress?: (p: UploadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress({ loaded: e.loaded, total: e.total })
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`R2 上传失败：HTTP ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('R2 上传网络错误'))
    xhr.send(file)
  })
}