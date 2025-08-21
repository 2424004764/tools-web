import { ApiResponse } from '../utils/db.js'
import { NotesService } from '../services/notesService.js'
import { Validator } from '../middlewares/validator.js'

export class NotesController {
  constructor(db) {
    this.notesService = new NotesService(db)
  }

  // 获取当前用户的所有笔记
  async index(user) {
    const result = await this.notesService.getAllNotes(user.id)
    
    if (!result.success) {
      return ApiResponse.error(result.error, 500)
    }
    
    return ApiResponse.success({ notes: result.data })
  }

  // 根据ID获取当前用户的笔记
  async show(id, user) {
    // 验证ID参数
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.notesService.getNoteById(id, user.id)
    
    if (!result.success) {
      return ApiResponse.error(result.error, 500)
    }
    
    return ApiResponse.success(result.data)
  }

  // 为当前用户创建笔记
  async store(data, user) {
    // 验证创建数据
    const validation = Validator.validateCreateNote(data)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.notesService.createNote(data, user.id)
    
    if (!result.success) {
      return ApiResponse.error(result.error, 500)
    }
    
    return ApiResponse.success(result.data, 201)
  }

  // 更新当前用户的笔记
  async update(id, data, user) {
    // 验证ID参数
    const idValidation = Validator.validateId(id)
    if (!idValidation.isValid) {
      return Validator.createValidationErrorResponse(idValidation.errors)
    }

    // 验证更新数据
    const dataValidation = Validator.validateUpdateNote(data)
    if (!dataValidation.isValid) {
      return Validator.createValidationErrorResponse(dataValidation.errors)
    }

    const result = await this.notesService.updateNote(id, data, user.id)
    
    if (!result.success) {
      return ApiResponse.error(result.error, 500)
    }
    
    return ApiResponse.success(result.data)
  }

  // 删除当前用户的笔记
  async destroy(id, user) {
    // 验证ID参数
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.notesService.deleteNote(id, user.id)
    
    if (!result.success) {
      return ApiResponse.error(result.error, 500)
    }
    
    return ApiResponse.success(result.data)
  }
}
