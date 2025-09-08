import { ApiResponse } from '../utils/db.js'
import { ResumeService } from '../services/resumeService.js'
import { Validator } from '../middlewares/validator.js'

export class ResumeController {
  constructor(db) {
    this.resumeService = new ResumeService(db)
  }

  // 获取当前用户的所有简历（支持分页）
  async index(user, pager, origin) {
    const result = await this.resumeService.getAllResumes(user.id, pager)
    
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    
    return ApiResponse.success(result.data, origin)
  }

  // 根据ID获取当前用户的简历
  async show(id, user, origin) {
    // 验证ID参数
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.resumeService.getResumeById(id, user.id)
    
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    
    return ApiResponse.success(result.data, origin)
  }

  // 为当前用户创建简历
  async store(data, user, origin) {
    // 验证创建数据
    const validation = Validator.validateCreateResume(data)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.resumeService.createResume(data, user.id)
    
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    
    return ApiResponse.success(result.data, origin, 201)
  }

  // 更新当前用户的简历
  async update(id, data, user, origin) {
    // 验证ID参数
    const idValidation = Validator.validateId(id)
    if (!idValidation.isValid) {
      return Validator.createValidationErrorResponse(idValidation.errors)
    }

    // 验证更新数据
    const dataValidation = Validator.validateUpdateResume(data)
    if (!dataValidation.isValid) {
      return Validator.createValidationErrorResponse(dataValidation.errors)
    }

    const result = await this.resumeService.updateResume(id, data, user.id)
    
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    
    return ApiResponse.success(result.data, origin)
  }

  // 删除当前用户的简历
  async destroy(id, user, origin) {
    // 验证ID参数
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.resumeService.deleteResume(id, user.id)
    
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    
    return ApiResponse.success(result.data, origin)
  }
}