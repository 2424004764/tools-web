import { ApiResponse } from '../utils/db.js'
import { MockSchemasService } from '../services/mockSchemasService.js'

const MAX_SCHEMA_FIELDS = 100
const MAX_SCHEMA_DEPTH = 5
const MAX_SCHEMA_OPTIONS = 100

export function validateRecipe(data, partial = false) {
  if (!data || typeof data !== 'object') return '请求体无效'
  if (!partial || data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) return 'name 字段为必填'
    if (data.name.length > 50) return 'name 不能超过 50 个字符'
  }
  if (data.description !== undefined && (typeof data.description !== 'string' || data.description.length > 200)) {
    return 'description 不能超过 200 个字符'
  }
  if (!partial || data.schema !== undefined) {
    if (!Array.isArray(data.schema) || data.schema.length === 0 || data.schema.length > MAX_SCHEMA_FIELDS) {
      return `schema 字段数量需为 1-${MAX_SCHEMA_FIELDS}`
    }
    let count = 0
    let expandedValues = 0
    const visit = (fields, depth, multiplier = 1) => {
      if (depth > MAX_SCHEMA_DEPTH) return false
      for (const field of fields) {
        if (!field || typeof field !== 'object' || typeof field.name !== 'string' || !field.name.trim() || field.name.length > 100) return false
        if (!['string', 'integer', 'float', 'boolean', 'email', 'name', 'phone', 'url', 'date', 'datetime', 'color', 'avatar', 'address', 'company', 'lorem', 'id', 'object', 'array'].includes(field.type)) return false
        if (++count > MAX_SCHEMA_FIELDS) return false
        if (field.min !== undefined && field.min !== null && (!Number.isFinite(Number(field.min)) || Number(field.min) < -1000000)) return false
        if (field.max !== undefined && field.max !== null && (!Number.isFinite(Number(field.max)) || Number(field.max) > 1000000)) return false
        if (field.min !== undefined && field.max !== undefined && field.min !== null && field.max !== null && Number(field.min) > Number(field.max)) return false
        if (Array.isArray(field.options) && field.options.length > MAX_SCHEMA_OPTIONS) return false
        if (field.options !== undefined && !Array.isArray(field.options)) return false
        if (Array.isArray(field.options) && field.options.some((option) => typeof option !== 'string' && typeof option !== 'number' && typeof option !== 'boolean')) return false
        if (field.type === 'array') {
          const min = Number(field.min ?? 1)
          const max = Number(field.max ?? 3)
          if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 100 || min > max) return false
          const children = field.itemType === 'object' ? field.itemChildren : null
          if (field.itemType === 'object' && (!Array.isArray(children) || !visit(children, depth + 1, multiplier * max))) return false
          if (field.itemType !== 'object' && !['string', 'integer', 'float', 'boolean', 'email', 'name', 'phone', 'url', 'date', 'datetime', 'color', 'avatar', 'address', 'company', 'lorem', 'id'].includes(field.itemType || 'string')) return false
          if (!children) expandedValues += multiplier * max
        } else if (field.type === 'object') {
          if (!Array.isArray(field.children) || !visit(field.children, depth + 1, multiplier)) return false
        } else {
          expandedValues += multiplier
        }
        if (expandedValues > 5000) return false
      }
      return true
    }
    if (!visit(data.schema, 1)) return 'schema 结构无效或超过复杂度限制'
    if (JSON.stringify(data.schema).length > 100_000) return 'schema 不能超过 100KB'
  }
  if (data.isPublic !== undefined && typeof data.isPublic !== 'boolean') return 'isPublic 必须为布尔值'
  return ''
}

export class MockSchemasController {
  constructor(db, env = null, waitUntil = null) {
    this.service = new MockSchemasService(db, env, waitUntil)
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
    const validationError = validateRecipe(data)
    if (validationError) return ApiResponse.error(validationError, origin, 400)
    const result = await this.service.createSchema(data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin, 201)
  }

  async update(id, data, user, origin) {
    if (!id) return ApiResponse.error('更新需要提供 ID', origin, 400)
    const validationError = validateRecipe(data, true)
    if (validationError) return ApiResponse.error(validationError, origin, 400)
    const result = await this.service.updateSchema(id, data, user.id)
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
