import { ApiResponse } from '../utils/db.js'
import { SalaryService } from '../services/salaryService.js'
import { SalaryValidator } from '../middlewares/salaryValidator.js'

export class SalaryController {
  constructor(db) {
    this.salaryService = new SalaryService(db)
  }

  // ===== 成员操作 =====

  async getMembers(user, origin) {
    const result = await this.salaryService.getAllMembers(user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async getMember(id, user, origin) {
    const validation = SalaryValidator.validateId(id)
    if (!validation.isValid) return SalaryValidator.createValidationErrorResponse(validation.errors)
    const result = await this.salaryService.getMemberById(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async createMember(data, user, origin) {
    const validation = SalaryValidator.validateCreateMember(data)
    if (!validation.isValid) return SalaryValidator.createValidationErrorResponse(validation.errors)
    const result = await this.salaryService.createMember(data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin, 201)
  }

  async updateMember(id, data, user, origin) {
    const idValidation = SalaryValidator.validateId(id)
    if (!idValidation.isValid) return SalaryValidator.createValidationErrorResponse(idValidation.errors)
    const dataValidation = SalaryValidator.validateUpdateMember(data)
    if (!dataValidation.isValid) return SalaryValidator.createValidationErrorResponse(dataValidation.errors)
    const result = await this.salaryService.updateMember(id, data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async deleteMember(id, user, origin) {
    const validation = SalaryValidator.validateId(id)
    if (!validation.isValid) return SalaryValidator.createValidationErrorResponse(validation.errors)
    const result = await this.salaryService.deleteMember(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  // ===== 工资记录操作 =====

  async getRecords(user, origin, queryParams = {}) {
    const options = {}
    if (queryParams.memberId !== undefined) options.memberId = queryParams.memberId
    if (queryParams.startDate !== undefined) options.startDate = queryParams.startDate
    if (queryParams.endDate !== undefined) options.endDate = queryParams.endDate
    if (queryParams.limit !== undefined) options.limit = parseInt(queryParams.limit)
    const result = await this.salaryService.getAllRecords(user.id, options)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async getRecord(id, user, origin) {
    const validation = SalaryValidator.validateId(id)
    if (!validation.isValid) return SalaryValidator.createValidationErrorResponse(validation.errors)
    const result = await this.salaryService.getRecordById(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async createRecord(data, user, origin) {
    const validation = SalaryValidator.validateCreateRecord(data)
    if (!validation.isValid) return SalaryValidator.createValidationErrorResponse(validation.errors)
    const result = await this.salaryService.createRecord(data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin, 201)
  }

  async updateRecord(id, data, user, origin) {
    const idValidation = SalaryValidator.validateId(id)
    if (!idValidation.isValid) return SalaryValidator.createValidationErrorResponse(idValidation.errors)
    const dataValidation = SalaryValidator.validateUpdateRecord(data)
    if (!dataValidation.isValid) return SalaryValidator.createValidationErrorResponse(dataValidation.errors)
    const result = await this.salaryService.updateRecord(id, data, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async deleteRecord(id, user, origin) {
    const validation = SalaryValidator.validateId(id)
    if (!validation.isValid) return SalaryValidator.createValidationErrorResponse(validation.errors)
    const result = await this.salaryService.deleteRecord(id, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  // ===== 统计 / 图表 / 导出 =====

  async getStatistics(user, origin, queryParams = {}) {
    const memberId = queryParams.memberId || null
    const result = await this.salaryService.getStatistics(user.id, memberId)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async getChartData(user, origin, queryParams = {}) {
    const memberId = queryParams.memberId || null
    const result = await this.salaryService.getChartData(user.id, memberId)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    return ApiResponse.success(result.data, origin)
  }

  async exportData(user, origin) {
    const result = await this.salaryService.exportData(user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 500)
    const { getCORSHeaders } = await import('../utils/cors.js')
    const headers = {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="salary_export.json"',
      ...getCORSHeaders(origin)
    }
    return new Response(JSON.stringify(result.data), { status: 200, headers })
  }
}
