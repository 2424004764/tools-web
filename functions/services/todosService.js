import { TodoModel, QueryBuilder } from '../utils/db.js'

export class TodosService {
  constructor(db) {
    this.todoModel = new TodoModel(db)
  }

  async getAllTodos(uid, pager, filters = {}) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)

      if (filters.title) {
        queryBuilder.where('title', 'LIKE', `%${filters.title}%`)
      }

      if (filters.priority) {
        queryBuilder.where('priority', '=', filters.priority)
      }

      queryBuilder.orderBy('createTime', 'DESC')

      pager.applyTo(queryBuilder)

      const countQuery = new QueryBuilder().where('uid', '=', uid)
      if (filters.title) {
        countQuery.where('title', 'LIKE', `%${filters.title}%`)
      }
      if (filters.priority) {
        countQuery.where('priority', '=', filters.priority)
      }

      const total = await this.todoModel.count(countQuery)
      const todos = await this.todoModel.findAll(queryBuilder)

      return {
        success: true,
        data: pager.createResult(todos, total)
      }
    } catch (error) {
      console.error('获取待办事项失败:', error)
      return { success: false, error: '获取待办事项列表失败' }
    }
  }

  async getTodoById(id, uid) {
    try {
      const todo = await this.todoModel.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )
      return { success: true, data: todo }
    } catch (error) {
      console.error('获取待办事项失败:', error)
      return { success: false, error: '获取待办事项详情失败' }
    }
  }

  async createTodo(todoData, uid) {
    try {
      const result = await this.todoModel.create({
        title: todoData.title.trim(),
        completed: todoData.completed || 0,
        priority: todoData.priority || 'medium',
        dueDate: todoData.dueDate || null,
        uid: uid
      })
      return {
        success: true,
        data: {
          id: result.id,
          message: '待办事项创建成功'
        }
      }
    } catch (error) {
      console.error('创建待办事项失败:', error)
      return { success: false, error: '创建待办事项失败' }
    }
  }

  async updateTodo(id, todoData, uid) {
    try {
      const updateData = {}
      if (todoData.title !== undefined) updateData.title = todoData.title.trim()
      if (todoData.completed !== undefined) updateData.completed = todoData.completed
      if (todoData.priority !== undefined) updateData.priority = todoData.priority
      if (todoData.dueDate !== undefined) updateData.dueDate = todoData.dueDate

      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const updateSuccess = await this.todoModel.updateWithQuery(updateData, queryBuilder)
      return {
        success: true,
        data: {
          updated: updateSuccess,
          message: updateSuccess ? '待办事项更新成功' : '待办事项不存在或无权限'
        }
      }
    } catch (error) {
      console.error('更新待办事项失败:', error)
      return { success: false, error: '更新待办事项失败' }
    }
  }

  async deleteTodo(id, uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const deleteSuccess = await this.todoModel.deleteWithQuery(queryBuilder)
      return {
        success: true,
        data: {
          deleted: deleteSuccess,
          message: deleteSuccess ? '待办事项删除成功' : '待办事项不存在或无权限'
        }
      }
    } catch (error) {
      console.error('删除待办事项失败:', error)
      return { success: false, error: '删除待办事项失败' }
    }
  }
}
