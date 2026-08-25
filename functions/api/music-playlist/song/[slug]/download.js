// 公开歌曲下载代理 —— 无需登录
//   GET /api/music-playlist/song/{slug}/download
//
// 为什么需要这个代理：
//   R2 公开域（*.r2.dev 或自定义 CDN）通常未配 Access-Control-Allow-Origin，
//   浏览器对跨域 fetch 做 CORS 预检会被拦，前端 downloadAudio 拿不到 blob。
//   CF Workers fetch R2 不受浏览器 CORS 限制，所以这里中转：后端 fetch → 流回前端。
//
// 同时设置 Content-Disposition: attachment，浏览器即使不开 downloadAudio 也能下载。
import { ApiResponse, initDatabase } from '../../../../utils/db.js'
import { MusicService } from '../../../../services/musicService.js'

const MIME_TO_EXT = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
}

// 文件名清洗：与 musicService.signR2PutUrl 的 safeFilename 思路一致
function safeFilename(name) {
  return String(name).replace(/[^\w.\-一-龥 ]/g, '_').slice(0, 80)
}

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
    const song = await service.getPublicSongBySlug(params.slug)
    if (!song) return ApiResponse.error('歌曲不存在或已关闭分享', origin, 404)
    if (!song.publicAudioUrl) {
      return ApiResponse.error('该歌曲暂时无法下载', origin, 502)
    }

    // Workers 内 fetch R2，无 CORS 限制
    let audioRes
    try {
      audioRes = await fetch(song.publicAudioUrl)
    } catch (e) {
      console.error('download: fetch R2 failed:', e)
      return ApiResponse.error('音频获取失败', origin, 502)
    }
    if (!audioRes.ok || !audioRes.body) {
      return ApiResponse.error(`音频不可用：HTTP ${audioRes.status}`, origin, 502)
    }

    const ext = MIME_TO_EXT[song.mimeType] || 'mp3'
    const safeTitle = safeFilename(song.title)
    const filename = `${safeTitle}.${ext}`

    // 透传关键头 + 强制下载 + CORS 透给前端
    const headers = new Headers()
    headers.set('Content-Type', song.mimeType)
    headers.set(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    )
    // 透传 Content-Length 让前端能算进度（可选）
    const len = audioRes.headers.get('Content-Length')
    if (len) headers.set('Content-Length', len)
    // CORS：同源请求 origin 为空，按 ApiResponse.cors 的策略不带 ACAO；跨源带 echo
    headers.set('Access-Control-Allow-Origin', origin || '*')
    headers.set('Access-Control-Expose-Headers', 'Content-Disposition')

    return new Response(audioRes.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('MusicSong download API error:', error)
    return ApiResponse.error('内部服务器错误', origin, 500)
  }
}

export async function onRequestOptions(context) {
  return ApiResponse.cors(context.request.headers.get('Origin'))
}