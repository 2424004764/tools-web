import { ApiResponse, Pager } from '../utils/db.js'
import { LifeTrajectoriesService } from '../services/lifeTrajectoriesService.js'

export class LifeTrajectoriesController {
  constructor(db) {
    this.service = new LifeTrajectoriesService(db)
  }

  // 公开列表（无需登录，按时间倒序）
  async index(origin) {
    const pager = Pager.fromRequest({ url: 'http://x?page=1&pageSize=20' }, 20)
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
    if (mood.length > 8) {
      return ApiResponse.error('心情标识过长', origin, 400)
    }

    const result = await this.service.create({ content, mood }, user.id)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    return ApiResponse.success(result.data, origin, 201)
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
