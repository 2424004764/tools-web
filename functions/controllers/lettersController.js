import { ApiResponse } from '../utils/db.js'
import { LettersService } from '../services/lettersService.js'
import { Validator } from '../middlewares/validator.js'

export class LettersController {
  constructor(db) {
    this.lettersService = new LettersService(db)
  }

  // 获取当前用户的所有信件（支持分页）
  async index(user, pager, origin) {
    const result = await this.lettersService.getAllLetters(user.id, pager)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 为当前用户创建信件
  async store(data, user, origin) {
    // 验证创建数据
    const validation = Validator.validateCreateLetter(data)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors, origin)
    }

    const result = await this.lettersService.createLetter(data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin, 201)
  }

  // 删除当前用户的信件
  async destroy(id, user, origin) {
    // 验证ID参数
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors, origin)
    }

    const result = await this.lettersService.deleteLetter(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }
}
