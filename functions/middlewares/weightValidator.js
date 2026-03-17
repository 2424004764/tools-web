import { ApiResponse } from '../utils/db.js'

export class WeightValidator {
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

  // 验证成员创建数据
  static validateCreateMember(data) {
    const errors = []

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('成员名称不能为空')
    }

    if (data.name && data.name.length > 50) {
      errors.push('成员名称长度不能超过50个字符')
    }

    if (data.height !== undefined && data.height !== null && (typeof data.height !== 'number' || data.height <= 0 || data.height > 300)) {
      errors.push('身高必须是1-300之间的数字')
    }

    if (data.goalWeight !== undefined && data.goalWeight !== null && (typeof data.goalWeight !== 'number' || data.goalWeight <= 0 || data.goalWeight > 300)) {
      errors.push('目标体重必须是1-300之间的数字')
    }

    if (data.avatarColor !== undefined && (!data.avatarColor || typeof data.avatarColor !== 'string' || !data.avatarColor.match(/^#[0-9A-F]{6}$/i))) {
      errors.push('颜色格式错误')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证成员更新数据
  static validateUpdateMember(data) {
    const errors = []

    if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
      errors.push('成员名称不能为空')
    }

    if (data.name && data.name.length > 50) {
      errors.push('成员名称长度不能超过50个字符')
    }

    if (data.height !== undefined && data.height !== null && (typeof data.height !== 'number' || data.height <= 0 || data.height > 300)) {
      errors.push('身高必须是1-300之间的数字')
    }

    if (data.goalWeight !== undefined && data.goalWeight !== null && (typeof data.goalWeight !== 'number' || data.goalWeight <= 0 || data.goalWeight > 300)) {
      errors.push('目标体重必须是1-300之间的数字')
    }

    if (data.avatarColor !== undefined && (!data.avatarColor || typeof data.avatarColor !== 'string' || !data.avatarColor.match(/^#[0-9A-F]{6}$/i))) {
      errors.push('颜色格式错误')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证体重记录创建数据
  static validateCreateRecord(data) {
    const errors = []

    if (!data.memberId || typeof data.memberId !== 'string' || data.memberId.trim().length === 0) {
      errors.push('成员ID不能为空')
    }

    if (!data.weight || typeof data.weight !== 'number' || data.weight <= 0 || data.weight > 500) {
      errors.push('体重必须是0-500之间的数字')
    }

    if (data.height !== undefined && data.height !== null && (typeof data.height !== 'number' || data.height <= 0 || data.height > 300)) {
      errors.push('身高必须是1-300之间的数字')
    }

    if (data.note !== undefined && data.note.length > 200) {
      errors.push('备注长度不能超过200个字符')
    }

    if (data.recordDate !== undefined && !this.isValidDate(data.recordDate)) {
      errors.push('记录日期格式错误')
    }

    if (data.recordTime !== undefined && !this.isValidTime(data.recordTime)) {
      errors.push('记录时间格式错误')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证体重记录更新数据
  static validateUpdateRecord(data) {
    const errors = []

    if (data.weight !== undefined && (typeof data.weight !== 'number' || data.weight <= 0 || data.weight > 500)) {
      errors.push('体重必须是0-500之间的数字')
    }

    if (data.height !== undefined && data.height !== null && (typeof data.height !== 'number' || data.height <= 0 || data.height > 300)) {
      errors.push('身高必须是1-300之间的数字')
    }

    if (data.note !== undefined && data.note.length > 200) {
      errors.push('备注长度不能超过200个字符')
    }

    if (data.recordDate !== undefined && !this.isValidDate(data.recordDate)) {
      errors.push('记录日期格式错误')
    }

    if (data.recordTime !== undefined && !this.isValidTime(data.recordTime)) {
      errors.push('记录时间格式错误')
    }

    if (data.memberId !== undefined && (!data.memberId || typeof data.memberId !== 'string' || data.memberId.trim().length === 0)) {
      errors.push('成员ID不能为空')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证日期格式 YYYY-MM-DD
  static isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/
    if (!regex.test(dateStr)) return false
    const date = new Date(dateStr)
    return !isNaN(date.getTime())
  }

  // 验证时间格式 HH:mm
  static isValidTime(timeStr) {
    const regex = /^\d{2}:\d{2}$/
    if (!regex.test(timeStr)) return false
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
  }

  // 创建验证错误响应
  static createValidationErrorResponse(errors) {
    return ApiResponse.error(`参数验证失败: ${errors.join(', ')}`, 400)
  }
}
