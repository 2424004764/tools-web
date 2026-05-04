import { ApiResponse } from '../utils/db.js'
import { BookmarksService } from '../services/bookmarksService.js'
import { Validator } from '../middlewares/validator.js'

export class BookmarksController {
  constructor(db) {
    this.bookmarksService = new BookmarksService(db)
  }

  // 获取当前用户的所有书签（支持分页）
  async index(user, pager, origin) {
    const result = await this.bookmarksService.getAllBookmarks(user.id, pager)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 根据ID获取当前用户的书签
  async show(id, user, origin) {
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.bookmarksService.getBookmarkById(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 为当前用户创建书签
  async store(data, user, origin) {
    const validation = Validator.validateCreateBookmark(data)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.bookmarksService.createBookmark(data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin, 201)
  }

  // 更新当前用户的书签
  async update(id, data, user, origin) {
    const idValidation = Validator.validateId(id)
    if (!idValidation.isValid) {
      return Validator.createValidationErrorResponse(idValidation.errors)
    }

    const dataValidation = Validator.validateUpdateBookmark(data)
    if (!dataValidation.isValid) {
      return Validator.createValidationErrorResponse(dataValidation.errors)
    }

    const result = await this.bookmarksService.updateBookmark(id, data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 删除当前用户的书签
  async destroy(id, user, origin) {
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.bookmarksService.deleteBookmark(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }
}
