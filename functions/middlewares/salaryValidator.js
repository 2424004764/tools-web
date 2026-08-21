import { ApiResponse } from '../utils/db.js'

export class SalaryValidator {
  // 验证ID
  static validateId(id) {
    const errors = []
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      errors.push('ID不能为空')
    }
    return { isValid: errors.length === 0, errors }
  }

  // ===== 成员校验 =====

  static validateCreateMember(data) {
    const errors = []

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('成员名称不能为空')
    }

    if (data.name && data.name.length > 50) {
      errors.push('成员名称长度不能超过50个字符')
    }

    if (data.avatarColor !== undefined && data.avatarColor !== null && data.avatarColor !== '' &&
        (!data.avatarColor || typeof data.avatarColor !== 'string' || !data.avatarColor.match(/^#[0-9A-F]{6}$/i))) {
      errors.push('颜色格式错误')
    }

    if (data.avatarEmoji !== undefined && data.avatarEmoji !== null && data.avatarEmoji !== '') {
      if (typeof data.avatarEmoji !== 'string' || data.avatarEmoji.length > 8) {
        errors.push('头像 emoji 长度不能超过8个字符')
      }
    }

    return { isValid: errors.length === 0, errors }
  }

  static validateUpdateMember(data) {
    const errors = []

    if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
      errors.push('成员名称不能为空')
    }

    if (data.name && data.name.length > 50) {
      errors.push('成员名称长度不能超过50个字符')
    }

    if (data.avatarColor !== undefined && data.avatarColor !== null && data.avatarColor !== '' &&
        (!data.avatarColor || typeof data.avatarColor !== 'string' || !data.avatarColor.match(/^#[0-9A-F]{6}$/i))) {
      errors.push('颜色格式错误')
    }

    if (data.avatarEmoji !== undefined && data.avatarEmoji !== null && data.avatarEmoji !== '') {
      if (typeof data.avatarEmoji !== 'string' || data.avatarEmoji.length > 8) {
        errors.push('头像 emoji 长度不能超过8个字符')
      }
    }

    return { isValid: errors.length === 0, errors }
  }

  // ===== 记录校验 =====

  static validateCreateRecord(data) {
    const errors = []

    if (data.monthlyIncome === undefined || data.monthlyIncome === null ||
        typeof data.monthlyIncome !== 'number' || data.monthlyIncome <= 0 || data.monthlyIncome > 10000000) {
      errors.push('月收入必须是0-10000000之间的数字（元）')
    }

    if (data.effectiveDate !== undefined && data.effectiveDate !== null && data.effectiveDate !== '' &&
        !this.isValidDate(data.effectiveDate)) {
      errors.push('生效日期格式错误（YYYY-MM-DD）')
    }

    if (data.source !== undefined && data.source && data.source.length > 100) {
      errors.push('来源长度不能超过100个字符')
    }

    if (data.note !== undefined && data.note && data.note.length > 500) {
      errors.push('备注长度不能超过500个字符')
    }

    if (data.memberId !== undefined && data.memberId !== null && data.memberId !== '' &&
        (typeof data.memberId !== 'string' || data.memberId.trim().length === 0)) {
      errors.push('成员ID格式错误')
    }

    return { isValid: errors.length === 0, errors }
  }

  static validateUpdateRecord(data) {
    const errors = []

    if (data.monthlyIncome !== undefined &&
        (typeof data.monthlyIncome !== 'number' || data.monthlyIncome <= 0 || data.monthlyIncome > 10000000)) {
      errors.push('月收入必须是0-10000000之间的数字（元）')
    }

    if (data.effectiveDate !== undefined && data.effectiveDate !== null && data.effectiveDate !== '' &&
        !this.isValidDate(data.effectiveDate)) {
      errors.push('生效日期格式错误（YYYY-MM-DD）')
    }

    if (data.source !== undefined && data.source && data.source.length > 100) {
      errors.push('来源长度不能超过100个字符')
    }

    if (data.note !== undefined && data.note && data.note.length > 500) {
      errors.push('备注长度不能超过500个字符')
    }

    if (data.memberId !== undefined && data.memberId !== null && data.memberId !== '' &&
        (typeof data.memberId !== 'string' || data.memberId.trim().length === 0)) {
      errors.push('成员ID格式错误')
    }

    return { isValid: errors.length === 0, errors }
  }

  static isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/
    if (!regex.test(dateStr)) return false
    const date = new Date(dateStr)
    return !isNaN(date.getTime())
  }

  static createValidationErrorResponse(errors) {
    return ApiResponse.error(`参数验证失败: ${errors.join(', ')}`, 400)
  }
}
