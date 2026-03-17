import { ApiResponse } from '../utils/db.js'
import { WeightService } from '../services/weightService.js'
import { WeightValidator } from '../middlewares/weightValidator.js'

export class WeightController {
  constructor(db) {
    this.weightService = new WeightService(db)
  }

  // ===== 成员操作 =====

  // 获取所有成员
  async getMembers(user, origin) {
    const result = await this.weightService.getAllMembers(user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 根据ID获取成员
  async getMember(id, user, origin) {
    const validation = WeightValidator.validateId(id)
    if (!validation.isValid) {
      return WeightValidator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.weightService.getMemberById(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 创建成员
  async createMember(data, user, origin) {
    const validation = WeightValidator.validateCreateMember(data)
    if (!validation.isValid) {
      return WeightValidator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.weightService.createMember(data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin, 201)
  }

  // 更新成员
  async updateMember(id, data, user, origin) {
    const idValidation = WeightValidator.validateId(id)
    if (!idValidation.isValid) {
      return WeightValidator.createValidationErrorResponse(idValidation.errors)
    }

    const dataValidation = WeightValidator.validateUpdateMember(data)
    if (!dataValidation.isValid) {
      return WeightValidator.createValidationErrorResponse(dataValidation.errors)
    }

    const result = await this.weightService.updateMember(id, data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 删除成员
  async deleteMember(id, user, origin) {
    const validation = WeightValidator.validateId(id)
    if (!validation.isValid) {
      return WeightValidator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.weightService.deleteMember(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // ===== 体重记录操作 =====

  // 获取体重记录列表
  async getRecords(user, origin, queryParams = {}) {
    const options = {}

    if (queryParams.memberId !== undefined) {
      options.memberId = queryParams.memberId
    }

    if (queryParams.startDate !== undefined) {
      options.startDate = queryParams.startDate
    }

    if (queryParams.endDate !== undefined) {
      options.endDate = queryParams.endDate
    }

    if (queryParams.limit !== undefined) {
      options.limit = parseInt(queryParams.limit)
    }

    const result = await this.weightService.getAllRecords(user.id, options)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 根据ID获取体重记录
  async getRecord(id, user, origin) {
    const validation = WeightValidator.validateId(id)
    if (!validation.isValid) {
      return WeightValidator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.weightService.getRecordById(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 创建体重记录
  async createRecord(data, user, origin) {
    const validation = WeightValidator.validateCreateRecord(data)
    if (!validation.isValid) {
      return WeightValidator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.weightService.createRecord(data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin, 201)
  }

  // 更新体重记录
  async updateRecord(id, data, user, origin) {
    const idValidation = WeightValidator.validateId(id)
    if (!idValidation.isValid) {
      return WeightValidator.createValidationErrorResponse(idValidation.errors)
    }

    const dataValidation = WeightValidator.validateUpdateRecord(data)
    if (!dataValidation.isValid) {
      return WeightValidator.createValidationErrorResponse(dataValidation.errors)
    }

    const result = await this.weightService.updateRecord(id, data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 删除体重记录
  async deleteRecord(id, user, origin) {
    const validation = WeightValidator.validateId(id)
    if (!validation.isValid) {
      return WeightValidator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.weightService.deleteRecord(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 获取统计数据
  async getStatistics(user, origin, queryParams = {}) {
    const memberId = queryParams.memberId || null

    const result = await this.weightService.getStatistics(user.id, memberId)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 获取图表数据
  async getChartData(user, origin, queryParams = {}) {
    const memberId = queryParams.memberId || null
    const days = parseInt(queryParams.days) || 30

    const result = await this.weightService.getChartData(user.id, memberId, days)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 导出数据
  async exportData(user, origin) {
    const result = await this.weightService.exportData(user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    const { getCORSHeaders } = await import('../utils/cors.js')
    const headers = {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="weight_export.json"',
      ...getCORSHeaders(origin)
    }

    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers
    })
  }
}
