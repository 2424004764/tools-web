import { ApiResponse } from '../utils/db.js'

// 比价物品的状态
const VALID_ITEM_STATUS = [0, 1, 2, 3]
// 比价条目的状态
const VALID_ENTRY_STATUS = [0, 1, 2, 3]

export class PriceComparisonValidator {
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

  static isValidUrl(url) {
    if (!url) return true
    if (typeof url !== 'string') return false
    if (url.length > 2000) return false
    try {
      // 允许非完整链接（如纯关键词），仅做长度/格式宽容
      if (url.startsWith('http://') || url.startsWith('https://')) {
        new URL(url)
      }
      return true
    } catch {
      return false
    }
  }

  // ===== 物品 =====

  static validateCreateItem(data) {
    const errors = []
    if (!data || typeof data !== 'object') {
      errors.push('请求体格式错误')
      return { isValid: false, errors }
    }

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('物品名称不能为空')
    }
    if (data.name && data.name.length > 100) {
      errors.push('物品名称长度不能超过100个字符')
    }

    if (data.category !== undefined && data.category && (typeof data.category !== 'string' || data.category.length > 30)) {
      errors.push('分类长度不能超过30个字符')
    }

    if (data.spec !== undefined && data.spec && (typeof data.spec !== 'string' || data.spec.length > 200)) {
      errors.push('规格长度不能超过200个字符')
    }

    if (data.note !== undefined && data.note && data.note.length > 1000) {
      errors.push('物品备注长度不能超过1000个字符')
    }

    if (data.status !== undefined && data.status !== null && !VALID_ITEM_STATUS.includes(data.status)) {
      errors.push('物品状态不合法')
    }

    return { isValid: errors.length === 0, errors }
  }

  static validateUpdateItem(data) {
    // 部分更新：只校验实际传入的字段，避免 status/isChosen 等快捷操作必须附带全部字段
    const errors = []
    if (!data || typeof data !== 'object') {
      errors.push('请求体格式错误')
      return { isValid: false, errors }
    }

    if (data.name !== undefined) {
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        errors.push('物品名称不能为空')
      } else if (data.name.length > 100) {
        errors.push('物品名称长度不能超过100个字符')
      }
    }

    if (data.category !== undefined && data.category !== null && data.category !== '') {
      if (typeof data.category !== 'string' || data.category.length > 30) {
        errors.push('分类长度不能超过30个字符')
      }
    }

    if (data.spec !== undefined && data.spec !== null && data.spec !== '') {
      if (typeof data.spec !== 'string' || data.spec.length > 200) {
        errors.push('规格长度不能超过200个字符')
      }
    }

    if (data.note !== undefined && data.note && data.note.length > 1000) {
      errors.push('物品备注长度不能超过1000个字符')
    }

    if (data.status !== undefined && data.status !== null && !VALID_ITEM_STATUS.includes(data.status)) {
      errors.push('物品状态不合法')
    }

    return { isValid: errors.length === 0, errors }
  }

  // ===== 价格条目 =====

  static validateCreateEntry(data) {
    const errors = []
    if (!data || typeof data !== 'object') {
      errors.push('请求体格式错误')
      return { isValid: false, errors }
    }

    if (!data.itemId || typeof data.itemId !== 'string' || data.itemId.trim().length === 0) {
      errors.push('所属物品ID不能为空')
    }

    if (!data.platform || typeof data.platform !== 'string' || data.platform.trim().length === 0) {
      errors.push('平台名称不能为空')
    }
    if (data.platform && data.platform.length > 50) {
      errors.push('平台名称长度不能超过50个字符')
    }

    if (data.unitPrice === undefined || data.unitPrice === null ||
        typeof data.unitPrice !== 'number' || data.unitPrice < 0 || data.unitPrice > 10000000) {
      errors.push('单价必须是0-10000000之间的数字（元）')
    }

    if (data.shippingFee !== undefined && data.shippingFee !== null &&
        (typeof data.shippingFee !== 'number' || data.shippingFee < 0 || data.shippingFee > 100000)) {
      errors.push('运费必须是0-100000之间的数字')
    }

    if (data.discount !== undefined && data.discount !== null &&
        (typeof data.discount !== 'number' || data.discount < 0 || data.discount > 10000000)) {
      errors.push('优惠金额必须是0-10000000之间的数字')
    }

    if (data.finalPrice !== undefined && data.finalPrice !== null &&
        (typeof data.finalPrice !== 'number' || data.finalPrice < 0 || data.finalPrice > 10000000)) {
      errors.push('最终价格必须是0-10000000之间的数字')
    }

    if (data.quantity !== undefined && data.quantity !== null) {
      if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 100000) {
        errors.push('数量必须是1-100000之间的整数')
      }
    }

    if (data.currency !== undefined && data.currency && (typeof data.currency !== 'string' || data.currency.length > 10)) {
      errors.push('币种长度不能超过10个字符')
    }

    if (data.status !== undefined && data.status !== null && !VALID_ENTRY_STATUS.includes(data.status)) {
      errors.push('条目状态不合法')
    }

    if (data.purchaseDate !== undefined && data.purchaseDate && !this.isValidDate(data.purchaseDate)) {
      errors.push('购买日期格式错误（YYYY-MM-DD）')
    }

    if (data.link !== undefined && data.link && !this.isValidUrl(data.link)) {
      errors.push('商品链接格式不正确')
    }

    if (data.seller !== undefined && data.seller && (typeof data.seller !== 'string' || data.seller.length > 100)) {
      errors.push('卖家/店铺名称长度不能超过100个字符')
    }

    if (data.note !== undefined && data.note && data.note.length > 1000) {
      errors.push('备注长度不能超过1000个字符')
    }

    return { isValid: errors.length === 0, errors }
  }

  static validateUpdateEntry(data) {
    // 部分更新：只校验实际传入的字段
    const errors = []
    if (!data || typeof data !== 'object') {
      errors.push('请求体格式错误')
      return { isValid: false, errors }
    }

    if (data.itemId !== undefined) {
      if (!data.itemId || typeof data.itemId !== 'string' || data.itemId.trim().length === 0) {
        errors.push('所属物品ID不能为空')
      }
    }

    if (data.platform !== undefined) {
      if (!data.platform || typeof data.platform !== 'string' || data.platform.trim().length === 0) {
        errors.push('平台名称不能为空')
      } else if (data.platform.length > 50) {
        errors.push('平台名称长度不能超过50个字符')
      }
    }

    if (data.unitPrice !== undefined && data.unitPrice !== null) {
      if (typeof data.unitPrice !== 'number' || data.unitPrice < 0 || data.unitPrice > 10000000) {
        errors.push('单价必须是0-10000000之间的数字（元）')
      }
    }

    if (data.shippingFee !== undefined && data.shippingFee !== null) {
      if (typeof data.shippingFee !== 'number' || data.shippingFee < 0 || data.shippingFee > 100000) {
        errors.push('运费必须是0-100000之间的数字')
      }
    }

    if (data.discount !== undefined && data.discount !== null) {
      if (typeof data.discount !== 'number' || data.discount < 0 || data.discount > 10000000) {
        errors.push('优惠金额必须是0-10000000之间的数字')
      }
    }

    if (data.finalPrice !== undefined && data.finalPrice !== null) {
      if (typeof data.finalPrice !== 'number' || data.finalPrice < 0 || data.finalPrice > 10000000) {
        errors.push('最终价格必须是0-10000000之间的数字')
      }
    }

    if (data.quantity !== undefined && data.quantity !== null) {
      if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 100000) {
        errors.push('数量必须是1-100000之间的整数')
      }
    }

    if (data.currency !== undefined && data.currency && (typeof data.currency !== 'string' || data.currency.length > 10)) {
      errors.push('币种长度不能超过10个字符')
    }

    if (data.status !== undefined && data.status !== null && !VALID_ENTRY_STATUS.includes(data.status)) {
      errors.push('条目状态不合法')
    }

    if (data.purchaseDate !== undefined && data.purchaseDate && !this.isValidDate(data.purchaseDate)) {
      errors.push('购买日期格式错误（YYYY-MM-DD）')
    }

    if (data.link !== undefined && data.link && !this.isValidUrl(data.link)) {
      errors.push('商品链接格式不正确')
    }

    if (data.seller !== undefined && data.seller && (typeof data.seller !== 'string' || data.seller.length > 100)) {
      errors.push('卖家/店铺名称长度不能超过100个字符')
    }

    if (data.note !== undefined && data.note && data.note.length > 1000) {
      errors.push('备注长度不能超过1000个字符')
    }

    return { isValid: errors.length === 0, errors }
  }

  static createValidationErrorResponse(errors) {
    return ApiResponse.error(`参数验证失败: ${errors.join(', ')}`, 400)
  }
}