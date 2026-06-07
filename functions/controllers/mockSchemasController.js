import { ApiResponse } from '../utils/db.js'
import { MockSchemasService } from '../services/mockSchemasService.js'

export class MockSchemasController {
  constructor(db) {
    this.service = new MockSchemasService(db)
  }

  async index(user, pager, origin) {
    const result = await this.service.getAllSchemas(user.id, pager)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async show(id, user, origin) {
    const result = await this.service.getSchemaById(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async store(data, user, origin) {
    if (!data || !data.name || !Array.isArray(data.schema) || data.schema.length === 0) {
      return ApiResponse.error('name 和 schema 字段为必填', origin, 400)
    }
    // user 可能为 null（未登录用户）
    const uid = user ? user.id : null
    const result = await this.service.createSchema(data, uid)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin, 201)
  }

  async update(id, data, user, origin) {
    if (!id) return ApiResponse.error('更新需要提供 ID', origin, 400)
    // user 可能为 null（未登录用户）
    const uid = user ? user.id : null
    const result = await this.service.updateSchema(id, data, uid)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async destroy(id, user, origin) {
    if (!id) return ApiResponse.error('删除需要提供 ID', origin, 400)
    const result = await this.service.deleteSchema(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }
}
