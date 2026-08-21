import { ApiResponse } from '../utils/db.js'
import { FixedExpenseService } from '../services/fixedExpenseService.js'
import { FixedExpenseValidator } from '../middlewares/fixedExpenseValidator.js'

export class FixedExpenseController {
  constructor(db) {
    this.service = new FixedExpenseService(db)
  }

  async getList(user, origin, queryParams = {}) {
    const options = {}
    if (queryParams.isActive !== undefined) {
      options.isActive = queryParams.isActive === 'true' || queryParams.isActive === '1'
    }
    if (queryParams.category !== undefined) options.category = queryParams.category

    const result = await this.service.getAll(user.id, options)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async getItem(id, user, origin) {
    const validation = FixedExpenseValidator.validateId(id)
    if (!validation.isValid) return FixedExpenseValidator.createValidationErrorResponse(validation.errors)
    const result = await this.service.getById(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async create(data, user, origin) {
    const validation = FixedExpenseValidator.validateCreate(data)
    if (!validation.isValid) return FixedExpenseValidator.createValidationErrorResponse(validation.errors)
    const result = await this.service.create(data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin, 201)
  }

  async update(id, data, user, origin) {
    const idValidation = FixedExpenseValidator.validateId(id)
    if (!idValidation.isValid) return FixedExpenseValidator.createValidationErrorResponse(idValidation.errors)
    const dataValidation = FixedExpenseValidator.validateUpdate(data)
    if (!dataValidation.isValid) return FixedExpenseValidator.createValidationErrorResponse(dataValidation.errors)
    const result = await this.service.update(id, data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async delete(id, user, origin) {
    const validation = FixedExpenseValidator.validateId(id)
    if (!validation.isValid) return FixedExpenseValidator.createValidationErrorResponse(validation.errors)
    const result = await this.service.delete(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async getStatistics(user, origin) {
    const result = await this.service.getStatistics(user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async exportData(user, origin) {
    const result = await this.service.exportData(user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    const { getCORSHeaders } = await import('../utils/cors.js')
    const headers = {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="fixed_expenses_export.json"',
      ...getCORSHeaders(origin)
    }
    return new Response(JSON.stringify(result.data), { status: 200, headers })
  }
}
