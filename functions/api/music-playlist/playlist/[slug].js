import { ApiResponse, initDatabase } from '../../../utils/db.js'
import { MusicService } from '../../../services/musicService.js'

// 公开歌单分享页 —— 无需登录
//   GET /api/music-playlist/playlist/{slug}
// 仅 is_public = 1 的歌单可读；访问即 +1 view_count
export async function onRequest(context) {
  const { request, env, params } = context
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  if (request.method !== 'GET') {
    return ApiResponse.error('不支持的请求方法', origin, 405)
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) return dbInit.response

  try {
    const service = new MusicService(dbInit.db, env)
    const data = await service.getPublicPlaylistBySlug(params.slug)
    if (!data) return ApiResponse.error('歌单不存在或已关闭分享', origin, 404)
    return ApiResponse.success(data, origin)
  } catch (error) {
    console.error('MusicPlaylist share API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}