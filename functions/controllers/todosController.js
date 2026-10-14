import { ApiResponse } from '../utils/db.js'
import { TodosService } from '../services/todosService.js'
import { Validator } from '../middlewares/validator.js'

export class TodosController {
  constructor(db, env = null, waitUntil = null) {
    this.todosService = new TodosService(db, env, waitUntil)
  }

  async index(user, pager, origin, filters) {
    const result = await this.todosService.getAllTodos(user.id, pager, filters)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  async show(id, user, origin) {
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.todosService.getTodoById(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  async store(data, user, origin) {
    const validation = Validator.validateCreateTodo(data)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.todosService.createTodo(data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin, 201)
  }

  async batchStore(data, user, origin) {
    // 空白条目（空行 / 纯空格）直接跳过不报错，全部为空白时才拦截
    const items = (Array.isArray(data?.items) ? data.items : []).filter(
      item => item && typeof item.title === 'string' && item.title.trim().length > 0
    )
    if (!items.length) {
      return ApiResponse.error('至少需要一条有效的待办内容', origin, 400)
    }

    const validation = Validator.validateBatchCreateTodos({ items })
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.todosService.createTodos(items, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin, 201)
  }

  async update(id, data, user, origin) {
    const idValidation = Validator.validateId(id)
    if (!idValidation.isValid) {
      return Validator.createValidationErrorResponse(idValidation.errors)
    }

    const dataValidation = Validator.validateUpdateTodo(data)
    if (!dataValidation.isValid) {
      return Validator.createValidationErrorResponse(dataValidation.errors)
    }

    const result = await this.todosService.updateTodo(id, data, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }

  async reorder(data, user, origin) {
    const validation = Validator.validateReorderTodos(data)
    if (!validation.isValid) return Validator.createValidationErrorResponse(validation.errors)

    const result = await this.todosService.reorderTodos(data.items, user.id)
    if (!result.success) return ApiResponse.error(result.error, origin, 400)
    return ApiResponse.success(result.data, origin)
  }
  async destroy(id, user, origin) {
    const validation = Validator.validateId(id)
    if (!validation.isValid) {
      return Validator.createValidationErrorResponse(validation.errors)
    }

    const result = await this.todosService.deleteTodo(id, user.id)

    if (!result.success) {
      return ApiResponse.error(result.error, origin, 500)
    }

    return ApiResponse.success(result.data, origin)
  }
}
