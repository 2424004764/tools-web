import { ApiResponse } from '../utils/db.js'
import { PriceComparisonService } from '../services/priceComparisonService.js'
import { PriceComparisonValidator } from '../middlewares/priceComparisonValidator.js'

export class PriceComparisonController {
  constructor(db) {
    this.service = new PriceComparisonService(db)
  }

  // ===== 物品 =====

  async getItems(user, origin, queryParams = {}) {
    const options = {}
    if (queryParams.status !== undefined) options.status = queryParams.status
    if (queryParams.category !== undefined) options.category = queryParams.category
    if (queryParams.keyword !== undefined) options.keyword = queryParams.keyword

    const result = await this.service.getAllItems(user.id, options)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async getItem(id, user, origin) {
    const validation = PriceComparisonValidator.validateId(id)
    if (!validation.isValid) return PriceComparisonValidator.createValidationErrorResponse(validation.errors)
    const result = await this.service.getItemById(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    if (!result.data) return ApiResponse.error('物品不存在或无权限', origin, 404)
    return ApiResponse.success(result.data, origin)
  }

  async createItem(data, user, origin) {
    const validation = PriceComparisonValidator.validateCreateItem(data)
    if (!validation.isValid) return PriceComparisonValidator.createValidationErrorResponse(validation.errors)
    const result = await this.service.createItem(data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin, 201)
  }

  async updateItem(id, data, user, origin) {
    const idValidation = PriceComparisonValidator.validateId(id)
    if (!idValidation.isValid) return PriceComparisonValidator.createValidationErrorResponse(idValidation.errors)
    const dataValidation = PriceComparisonValidator.validateUpdateItem(data)
    if (!dataValidation.isValid) return PriceComparisonValidator.createValidationErrorResponse(dataValidation.errors)
    const result = await this.service.updateItem(id, data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async deleteItem(id, user, origin) {
    const validation = PriceComparisonValidator.validateId(id)
    if (!validation.isValid) return PriceComparisonValidator.createValidationErrorResponse(validation.errors)
    const result = await this.service.deleteItem(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  // ===== 条目 =====

  async getEntries(user, origin, queryParams = {}) {
    const itemId = queryParams.itemId || null
    const result = await this.service.getEntries(itemId, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async getEntry(id, user, origin) {
    const validation = PriceComparisonValidator.validateId(id)
    if (!validation.isValid) return PriceComparisonValidator.createValidationErrorResponse(validation.errors)
    const result = await this.service.getEntryById(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    if (!result.data) return ApiResponse.error('条目不存在或无权限', origin, 404)
    return ApiResponse.success(result.data, origin)
  }

  async createEntry(data, user, origin) {
    const validation = PriceComparisonValidator.validateCreateEntry(data)
    if (!validation.isValid) return PriceComparisonValidator.createValidationErrorResponse(validation.errors)
    const result = await this.service.createEntry(data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin, 201)
  }

  async updateEntry(id, data, user, origin) {
    const idValidation = PriceComparisonValidator.validateId(id)
    if (!idValidation.isValid) return PriceComparisonValidator.createValidationErrorResponse(idValidation.errors)
    const dataValidation = PriceComparisonValidator.validateUpdateEntry(data)
    if (!dataValidation.isValid) return PriceComparisonValidator.createValidationErrorResponse(dataValidation.errors)
    const result = await this.service.updateEntry(id, data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async deleteEntry(id, user, origin) {
    const validation = PriceComparisonValidator.validateId(id)
    if (!validation.isValid) return PriceComparisonValidator.createValidationErrorResponse(validation.errors)
    const result = await this.service.deleteEntry(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  // ===== 统计 =====

  async getStatistics(user, origin) {
    const result = await this.service.getStatistics(user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }
}