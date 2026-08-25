import { ApiResponse, initDatabase } from '../../../../utils/db.js'
import { MusicService } from '../../../../services/musicService.js'

// 公开播放计数 —— 无需登录
//   POST /api/music-playlist/song/{slug}/play
// 仅 +1 play_count，前端在 <audio>.play 事件触发（30s 防抖由前端控制）
export async function onRequest(context) {
  const { request, env, params } = context
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') return ApiResponse.cors(origin)
  if (request.method !== 'POST') {
    return ApiResponse.error('不支持的请求方法', origin, 405)
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) return dbInit.response

  try {
    const service = new MusicService(dbInit.db, env)
    const playCount = await service.incrementPlayCountBySlug(params.slug)
    if (playCount === null) return ApiResponse.error('歌曲不存在或已关闭分享', origin, 404)
    return ApiResponse.success({ playCount }, origin)
  } catch (error) {
    console.error('MusicSong play API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}