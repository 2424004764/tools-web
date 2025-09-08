import { ApiResponse } from '../utils/db.js'

export class Validator {
  // 验证笔记创建数据
  static validateCreateNote(data) {
    const errors = []
    
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      errors.push('标题不能为空')
    }
    
    if (data.title && data.title.length > 200) {
      errors.push('标题长度不能超过200个字符')
    }
    
    if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0) {
      errors.push('内容不能为空')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证笔记更新数据
  static validateUpdateNote(data) {
    const errors = []
    
    if (data.title !== undefined && (typeof data.title !== 'string' || data.title.trim().length === 0)) {
      errors.push('标题不能为空')
    }
    
    if (data.title && data.title.length > 200) {
      errors.push('标题长度不能超过200个字符')
    }
    
    if (data.content !== undefined && (typeof data.content !== 'string' || data.content.trim().length === 0)) {
      errors.push('内容不能为空')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证ID参数
  static validateId(id) {
    const errors = []
    
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      errors.push('ID不能为空')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证简历创建数据
  static validateCreateResume(data) {
    const errors = []
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('简历名称不能为空')
    }
    
    if (data.name && data.name.length > 100) {
      errors.push('简历名称长度不能超过100个字符')
    }

    if (data.template && typeof data.template !== 'string') {
      errors.push('模板参数格式错误')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证简历更新数据
  static validateUpdateResume(data) {
    const errors = []
    
    if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
      errors.push('简历名称不能为空')
    }
    
    if (data.name && data.name.length > 100) {
      errors.push('简历名称长度不能超过100个字符')
    }

    if (data.template !== undefined && typeof data.template !== 'string') {
      errors.push('模板参数格式错误')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 创建验证错误响应
  static createValidationErrorResponse(errors) {
    return ApiResponse.error(`参数验证失败: ${errors.join(', ')}`, 400)
  }
}
