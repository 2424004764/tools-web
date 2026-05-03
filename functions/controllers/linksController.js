import { ApiResponse } from '../utils/db.js'
import { LinksService } from '../services/linksService.js'

export class LinksController {
  constructor(db) {
    this.linksService = new LinksService(db)
  }

  async store(data, origin) {
    const result = await this.linksService.createLink(data)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 400)
    }
    return ApiResponse.success(result.data, origin, 201)
  }

  async show(slug, origin) {
    const result = await this.linksService.getLink(slug)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 404)
    }
    return ApiResponse.success(result.data, origin)
  }

  async index(uid, pager, origin) {
    const result = await this.linksService.listLinks(uid, pager)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    return ApiResponse.success(result.data, origin)
  }

  async destroy(slug, origin) {
    await this.linksService.deleteLink(slug)
    return ApiResponse.success({ success: true }, origin)
  }
}
