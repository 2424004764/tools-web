import { ApiResponse } from '../utils/db.js'
import { PasswordService } from '../services/passwordService.js'
import { Validator } from '../middlewares/validator.js'

export class PasswordController {
  constructor(db) {
    this.passwordService = new PasswordService(db)
  }

  // ===== 分组操作 =====

  // 获取所有分组
  async getGroups(user, origin) {
    const result = await this.passwordService.getAllGroups(user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 根据ID获取分组
  async getGroup(id, user, origin) {
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.passwordService.getGroupById(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 创建分组
  async createGroup(data, user, origin) {
    const validation = Validator.validateCreateGroup(data)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.passwordService.createGroup(data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin, 201)
  }

  // 更新分组
  async updateGroup(id, data, user, origin) {
    const idValidation = Validator.validateId(id)
    if (!idValidation.isValid) {
      return Validator.createValidationErrorResponse(idValidation.errors)
    }

    const dataValidation = Validator.validateUpdateGroup(data)
    if (!dataValidation.isValid) {
      return Validator.createValidationErrorResponse(dataValidation.errors)
    }

    const result = await this.passwordService.updateGroup(id, data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 删除分组
  async deleteGroup(id, user, origin) {
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.passwordService.deleteGroup(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // ===== 密码条目操作 =====

  // 获取所有密码条目
  async getEntries(user, origin, queryParams = {}) {
    const options = {}

    // 支持按分组过滤
    if (queryParams.groupId !== undefined) {
      options.groupId = queryParams.groupId
    }

    // 支持分页
    if (queryParams.page !== undefined) {
      options.page = parseInt(queryParams.page)
    }
    if (queryParams.pageSize !== undefined) {
      options.pageSize = parseInt(queryParams.pageSize)
    }

    // 支持搜索
    if (queryParams.search !== undefined) {
      options.search = queryParams.search
    }

    const result = await this.passwordService.getAllEntries(user.id, options)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 根据ID获取密码条目
  async getEntry(id, user, origin) {
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.passwordService.getEntryById(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 创建密码条目
  async createEntry(data, user, origin) {
    const validation = Validator.validateCreatePasswordEntry(data)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.passwordService.createEntry(data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin, 201)
  }

  // 更新密码条目
  async updateEntry(id, data, user, origin) {
    const idValidation = Validator.validateId(id)
    if (!idValidation.isValid) {
      return Validator.createValidationErrorResponse(idValidation.errors)
    }

    const dataValidation = Validator.validateUpdatePasswordEntry(data)
    if (!dataValidation.isValid) {
      return Validator.createValidationErrorResponse(dataValidation.errors)
    }

    const result = await this.passwordService.updateEntry(id, data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 删除密码条目
  async deleteEntry(id, user, origin) {
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.passwordService.deleteEntry(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 导出密码
  async exportEntries(user, origin) {
    const result = await this.passwordService.exportEntries(user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    // 返回 JSON 文件
    const { getCORSHeaders } = await import('../utils/cors.js')
    const headers = {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="passwords_export.json"',
      ...getCORSHeaders(origin)
    }

    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers
    })
  }

  // 导入密码
  async importEntries(file, user, origin) {
    if (!file) {
      return ApiResponse.error('请选择要导入的文件', origin, 400)
    }

    const result = await this.passwordService.importEntries(user.id, file)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }
}
