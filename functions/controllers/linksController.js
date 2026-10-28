import { ApiResponse } from '../utils/db.js'
import { LinksService } from '../services/linksService.js'

export class LinksController {
  constructor(db, env = null, waitUntil = null) {
    this.linksService = new LinksService(db, env, waitUntil)
  }

  async store(data, origin, uid = null) {
    const result = await this.linksService.createLink(data, uid)
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

  async destroy(slug, uid, origin) {
    const result = await this.linksService.deleteLink(slug, uid)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 404)
    }
    return ApiResponse.success({ success: true }, origin)
  }
}
