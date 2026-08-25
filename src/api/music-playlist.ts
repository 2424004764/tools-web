import { functionsRequest } from '@/utils/functionsRequest'
import type {
  Song,
  SongMeta,
  SongDetail,
  PlaylistMeta,
  PlaylistDetail,
  UploadUrlResponse,
  PublicSong,
  PublicPlaylist,
  PagedResponse,
  Pagination,
} from '@/components/Tools/Music/types'

const EMPTY_PAGINATION: Pagination = {
  total: 0, page: 1, pageSize: 20, totalPages: 0, hasNext: false, hasPrev: false,
}

// ============ 鉴权 API ============

/** 申请 SigV4 预签名 PUT URL（用于浏览器直传 R2） */
export async function requestUploadUrl(payload: {
  filename: string
  mimeType: string
  fileSize: number
}): Promise<UploadUrlResponse> {
  const res = await functionsRequest.post('/api/music-playlist/songs/upload-url', payload)
  return res.data as UploadUrlResponse
}

/** 创建歌曲元数据（R2 上传成功后调用） */
export async function createSong(payload: {
  title: string
  artist?: string
  album?: string
  r2Key: string
  mimeType: string
  fileSize: number
  durationSec?: number | null
}): Promise<Song> {
  const res = await functionsRequest.post('/api/music-playlist/songs', payload)
  return res.data as Song
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