import { ApiResponse, Pager } from '../utils/db.js'
import { LifeTrajectoriesService } from '../services/lifeTrajectoriesService.js'

const MOOD_OPTIONS = new Set(['🌱', '🌸', '☀️', '🌧️', '🌈', '🔥', '🌙', '⭐', '🍀', '☕', '📚', '🎵'])

export class LifeTrajectoriesController {
  constructor(db, env = null, waitUntil = null) {
    this.service = new LifeTrajectoriesService(db, env, waitUntil)
  }

  // 公开列表（无需登录，按时间倒序）
  async index(request, origin) {
    const pager = Pager.fromRequest(request, 20)
    const result = await this.service.list(pager)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    return ApiResponse.success(result.data, origin)
  }

  // 发布（必须登录）
  async store(data, user, origin) {
    const content = (data.content || '').trim()
    const mood = (data.mood || '🌱').trim()

    if (!content) {
      return ApiResponse.error('内容不能为空', origin, 400)
    }
    if (content.length > 500) {
      return ApiResponse.error('内容最多 500 字', origin, 400)
    }
    if (!MOOD_OPTIONS.has(mood)) {
      return ApiResponse.error('心情标识不合法', origin, 400)
    }

    const result = await this.service.create({ content, mood }, user.id)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    return ApiResponse.success(result.data, origin, 201)
  }

  // 更新（必须登录，只能更新自己的轨迹）
  async update(id, data, user, origin) {
    if (!id) {
      return ApiResponse.error('缺少轨迹 ID', origin, 400)
    }

    const content = (data.content || '').trim()
    const mood = (data.mood || '🌱').trim()
    if (!content) {
      return ApiResponse.error('内容不能为空', origin, 400)
    }
    if (content.length > 500) {
      return ApiResponse.error('内容最多 500 字', origin, 400)
    }
    if (!MOOD_OPTIONS.has(mood)) {
      return ApiResponse.error('心情标识不合法', origin, 400)
    }

    const result = await this.service.update(id, { content, mood }, user.id)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    return ApiResponse.success(result.data, origin)
  }

  // 删除（必须登录，只能删自己的）
  async destroy(id, user, origin) {
    if (!id) {
      return ApiResponse.error('缺少轨迹 ID', origin, 400)
    }
    const result = await this.service.remove(id, user.id)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    return ApiResponse.success(result.data, origin)
  }
}
