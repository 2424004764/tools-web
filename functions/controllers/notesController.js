import { ApiResponse } from '../utils/db.js'
import { NotesService } from '../services/notesService.js'
import { Validator } from '../middlewares/validator.js'

export class NotesController {
  constructor(db, env = null, waitUntil = null) {
    this.notesService = new NotesService(db, env, waitUntil)
  }

  // ===== 笔记分组 =====

  // GET /api/notes/groups - 获取当前用户的所有分组（含笔记计数）
  async getGroups(user, origin) {
    const result = await this.notesService.getAllGroups(user.id)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    return ApiResponse.success(result.data, origin)
  }

  // GET /api/notes/groups/{id}
  async getGroup(id, user, origin) {
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }
    const result = await this.notesService.getGroupById(id, user.id)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    if (!result.data) {
      return ApiResponse.error('分组不存在或无权限', origin, 404)
    }
    return ApiResponse.success(result.data, origin)
  }

  // POST /api/notes/groups
  async createGroup(data, user, origin) {
    const validation = Validator.validateCreateNoteGroup(data)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }
    const result = await this.notesService.createGroup(data, user.id)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    return ApiResponse.success(result.data, origin, 201)
  }

  // PUT /api/notes/groups/{id}
  async updateGroup(id, data, user, origin) {
    const idValidation = Validator.validateId(id)
    if (!idValidation.isValid) {
      return Validator.createValidationErrorResponse(idValidation.errors)
    }
    const dataValidation = Validator.validateUpdateNoteGroup(data)
    if (!dataValidation.isValid) {
      return Validator.createValidationErrorResponse(dataValidation.errors)
    }
    const result = await this.notesService.updateGroup(id, data, user.id)
    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }
    return ApiResponse.success(result.data, origin)
  }

  // DELETE /api/notes/groups/{id}
  async deleteGroup(id, user, origin) {
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }
    const result = await this.notesService.deleteGroup(id, user.id)
    if (!result.success) {
      const status = result.status || 500
      return ApiResponse.error(result.error, origin, status)
    }
    return ApiResponse.success(result.data, origin)
  }

  // ===== 笔记 =====

  // 获取当前用户的所有笔记（支持分页 + 分组过滤）
  async index(user, pager, request, origin) {
    const url = new URL(request.url)
    const filters = {
      groupId: url.searchParams.get('groupId') || 'all'
    }
    const result = await this.notesService.getAllNotes(user.id, pager, filters)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 根据ID获取当前用户的笔记
  async show(id, user, origin) {
    // 验证ID参数
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.notesService.getNoteById(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 为当前用户创建笔记
  async store(data, user, origin) {
    // 验证创建数据
    const validation = Validator.validateCreateNote(data)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.notesService.createNote(data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin, 201)
  }

  // 更新当前用户的笔记
  async update(id, data, user, origin) {
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
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  // 删除当前用户的笔记
  async destroy(id, user, origin) {
    // 验证ID参数
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.notesService.deleteNote(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }
}