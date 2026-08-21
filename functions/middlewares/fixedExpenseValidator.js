import { ApiResponse } from '../utils/db.js'

export class FixedExpenseValidator {
  static validateId(id) {
    const errors = []
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      errors.push('ID不能为空')
    }
    return { isValid: errors.length === 0, errors }
  }

  static isValidDate(dateStr) {
    if (!dateStr) return true
    const regex = /^\d{4}-\d{2}-\d{2}$/
    if (!regex.test(dateStr)) return false
    const date = new Date(dateStr)
    return !isNaN(date.getTime())
  }

  static validateCreate(data) {
    const errors = []

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('开销名称不能为空')
    }
    if (data.name && data.name.length > 50) {
      errors.push('开销名称长度不能超过50个字符')
    }

    if (data.amount === undefined || data.amount === null ||
        typeof data.amount !== 'number' || data.amount <= 0 || data.amount > 10000000) {
      errors.push('金额必须是0-10000000之间的数字（元）')
    }

    if (data.category !== undefined && data.category && (typeof data.category !== 'string' || data.category.length > 30)) {
      errors.push('分类长度不能超过30个字符')
    }

    if (data.billingDay !== undefined && data.billingDay !== null && data.billingDay !== '' &&
        (!Number.isInteger(data.billingDay) || data.billingDay < 1 || data.billingDay > 31)) {
      errors.push('扣款日必须是1-31之间的整数')
    }

    if (data.startDate !== undefined && data.startDate && !this.isValidDate(data.startDate)) {
      errors.push('启用日期格式错误（YYYY-MM-DD）')
    }

    if (data.endDate !== undefined && data.endDate && !this.isValidDate(data.endDate)) {
      errors.push('结束日期格式错误（YYYY-MM-DD）')
    }

    if (data.note !== undefined && data.note && data.note.length > 500) {
      errors.push('备注长度不能超过500个字符')
    }

    return { isValid: errors.length === 0, errors }
  }

  static validateUpdate(data) {
    const errors = []

    if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
      errors.push('开销名称不能为空')
    }
    if (data.name && data.name.length > 50) {
      errors.push('开销名称长度不能超过50个字符')
    }

    if (data.amount !== undefined &&
        (typeof data.amount !== 'number' || data.amount <= 0 || data.amount > 10000000)) {
      errors.push('金额必须是0-10000000之间的数字（元）')
    }

    if (data.category !== undefined && data.category && (typeof data.category !== 'string' || data.category.length > 30)) {
      errors.push('分类长度不能超过30个字符')
    }

    if (data.billingDay !== undefined && data.billingDay !== null && data.billingDay !== '' &&
        (!Number.isInteger(data.billingDay) || data.billingDay < 1 || data.billingDay > 31)) {
      errors.push('扣款日必须是1-31之间的整数')
    }

    if (data.startDate !== undefined && data.startDate && !this.isValidDate(data.startDate)) {
      errors.push('启用日期格式错误（YYYY-MM-DD）')
    }

    if (data.endDate !== undefined && data.endDate && !this.isValidDate(data.endDate)) {
      errors.push('结束日期格式错误（YYYY-MM-DD）')
    }

    if (data.note !== undefined && data.note && data.note.length > 500) {
      errors.push('备注长度不能超过500个字符')
    }

    return { isValid: errors.length === 0, errors }
  }

  static createValidationErrorResponse(errors) {
    return ApiResponse.error(`参数验证失败: ${errors.join(', ')}`, 400)
  }
}
