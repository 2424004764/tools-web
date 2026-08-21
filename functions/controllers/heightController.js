import { ApiResponse } from '../utils/db.js'
import { HeightService } from '../services/heightService.js'
import { HeightValidator } from '../middlewares/heightValidator.js'

export class HeightController {
  constructor(db) {
    this.heightService = new HeightService(db)
  }

  // ===== 成员操作 =====

  async getMembers(user, origin) {
    const result = await this.heightService.getAllMembers(user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async getMember(id, user, origin) {
    const validation = HeightValidator.validateId(id)
    if (!validation.isValid) return HeightValidator.createValidationErrorResponse(validation.errors)

    const result = await this.heightService.getMemberById(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async createMember(data, user, origin) {
    const validation = HeightValidator.validateCreateMember(data)
    if (!validation.isValid) return HeightValidator.createValidationErrorResponse(validation.errors)

    const result = await this.heightService.createMember(data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin, 201)
  }

  async updateMember(id, data, user, origin) {
    const idValidation = HeightValidator.validateId(id)
    if (!idValidation.isValid) return HeightValidator.createValidationErrorResponse(idValidation.errors)

    const dataValidation = HeightValidator.validateUpdateMember(data)
    if (!dataValidation.isValid) return HeightValidator.createValidationErrorResponse(dataValidation.errors)

    const result = await this.heightService.updateMember(id, data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async deleteMember(id, user, origin) {
    const validation = HeightValidator.validateId(id)
    if (!validation.isValid) return HeightValidator.createValidationErrorResponse(validation.errors)

    const result = await this.heightService.deleteMember(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  // ===== 身高记录操作 =====

  async getRecords(user, origin, queryParams = {}) {
    const options = {}
    if (queryParams.memberId !== undefined) options.memberId = queryParams.memberId
    if (queryParams.startDate !== undefined) options.startDate = queryParams.startDate
    if (queryParams.endDate !== undefined) options.endDate = queryParams.endDate
    if (queryParams.limit !== undefined) options.limit = parseInt(queryParams.limit)

    const result = await this.heightService.getAllRecords(user.id, options)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async getRecord(id, user, origin) {
    const validation = HeightValidator.validateId(id)
    if (!validation.isValid) return HeightValidator.createValidationErrorResponse(validation.errors)

    const result = await this.heightService.getRecordById(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async createRecord(data, user, origin) {
    const validation = HeightValidator.validateCreateRecord(data)
    if (!validation.isValid) return HeightValidator.createValidationErrorResponse(validation.errors)

    const result = await this.heightService.createRecord(data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin, 201)
  }

  async updateRecord(id, data, user, origin) {
    const idValidation = HeightValidator.validateId(id)
    if (!idValidation.isValid) return HeightValidator.createValidationErrorResponse(idValidation.errors)

    const dataValidation = HeightValidator.validateUpdateRecord(data)
    if (!dataValidation.isValid) return HeightValidator.createValidationErrorResponse(dataValidation.errors)

    const result = await this.heightService.updateRecord(id, data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async deleteRecord(id, user, origin) {
    const validation = HeightValidator.validateId(id)
    if (!validation.isValid) return HeightValidator.createValidationErrorResponse(validation.errors)

    const result = await this.heightService.deleteRecord(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  // ===== 统计 / 图表 / 导出 =====

  async getStatistics(user, origin, queryParams = {}) {
    const memberId = queryParams.memberId || null
    const result = await this.heightService.getStatistics(user.id, memberId)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async getChartData(user, origin, queryParams = {}) {
    const memberId = queryParams.memberId || null
    const days = parseInt(queryParams.days) || 30
    const result = await this.heightService.getChartData(user.id, memberId, days)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async exportData(user, origin) {
    const result = await this.heightService.exportData(user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)

    const { getCORSHeaders } = await import('../utils/cors.js')
    const headers = {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="height_export.json"',
      ...getCORSHeaders(origin)
    }
    return new Response(JSON.stringify(result.data), { status: 200, headers })
  }
}