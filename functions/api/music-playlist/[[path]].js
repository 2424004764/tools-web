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
import { MusicService, ValidationError } from '../../services/musicService.js'

// 解析 /api/music-playlist/songs/{id}/play → { collection:'songs', id, action:'play' }
function parseSongSubPath(path) {
  // path 形如 /songs/{id}/play 或 /songs/{id}
  const m = path.match(/^\/songs\/([^/]+)(?:\/(play))?\/?$/)
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

    // /songs/{id} 与 /songs/{id}/play
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