import { TodoModel, QueryBuilder } from '../utils/db.js'

export class TodosService {
  constructor(db, env = null, waitUntil = null) {
    this.todoModel = new TodoModel(db, env, waitUntil)
  }

  async getAllTodos(uid, pager, filters = {}) {
    try {
      // 状态三态：0=已创建，2=进行中，1=已完成；支持逗号分隔多选（如 completed=0,2）
      let completedFilters = null
      if (filters.completed !== undefined && filters.completed !== '') {
        const raw = String(filters.completed).split(',').map(v => v.trim()).filter(Boolean)
        const statuses = [...new Set(raw.map(Number))]
        if (statuses.length === 0 || statuses.some(v => ![0, 1, 2].includes(v))) {
          return { success: false, error: '状态筛选值无效' }
        }
        completedFilters = statuses
      }

      const applyFilters = (queryBuilder) => {
        if (filters.title) {
          queryBuilder.where('title', 'LIKE', `%${filters.title}%`)
        }
        if (filters.priority) {
          queryBuilder.where('priority', '=', filters.priority)
        }
        if (filters.category) {
          queryBuilder.where('category', '=', filters.category)
        }
        if (completedFilters !== null) {
          queryBuilder.where('completed', 'IN', completedFilters)
        }
        return queryBuilder
      }

      const countQuery = applyFilters(new QueryBuilder().where('uid', '=', uid))

      const total = await this.todoModel.count(countQuery)

      // 各分类的真实总数（与当前筛选条件一致、不受分页影响），供前端分组徽标展示
      const categoryQb = applyFilters(new QueryBuilder().where('uid', '=', uid))
      const categoryWhere = categoryQb.buildWhere(this.todoModel)
      const categoryRows = await this.todoModel.db
        .prepare(`SELECT category, COUNT(*) AS count FROM todos${categoryWhere.sql} GROUP BY category`)
        .bind(...categoryWhere.params)
        .all()
      const categoryCounts = {}
      for (const row of categoryRows.results || []) {
        categoryCounts[row.category || '默认'] = row.count
      }

      // 前端按分类分组展示，分页也按分类各自切片（ROW_NUMBER 按分类分区编号）：
      // 每个分类取自己的第 page 页，保证任一分类在第 1 页都能看到自己的条目，
      // 不会出现「某分类共 N 条但当前页一条都不显示」的空组。
      // 组内排序：sortOrder ASC——创建时写入负值（-Date.now()），越新越小排最前；
      // 拖拽排序后组内是 0..n-1，保持手动顺序。分组顺序按各组最小 sortOrder，最近活跃的分组在前。
      const listQb = applyFilters(new QueryBuilder().where('uid', '=', uid))
      const listWhere = listQb.buildWhere(this.todoModel)
      const rnStart = pager.offset + 1
      const rnEnd = pager.offset + pager.pageSize
      const pagedRows = await this.todoModel.db
        .prepare(`SELECT * FROM (
          SELECT t.*,
            MIN(COALESCE(t.sort_order, 0)) OVER (PARTITION BY COALESCE(t.category, '默认')) AS __group_order,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(t.category, '默认')
              ORDER BY COALESCE(t.sort_order, 0) ASC, t.create_time DESC, t.id ASC
            ) AS __row_number
          FROM todos t${listWhere.sql}
        )
        WHERE __row_number >= ? AND __row_number <= ?
        ORDER BY __group_order ASC, __row_number ASC`)
        .bind(...listWhere.params, rnStart, rnEnd)
        .all()
      const todos = (pagedRows.results || []).map(row => this.todoModel.mapFromDb(row))

      const result = pager.createResult(todos, total)
      // 每页是各分类各自的第 page 页，总页数按「条数最多的分类」算，而不是总数
      const maxCategoryCount = Math.max(0, ...Object.values(categoryCounts).map(v => Number(v) || 0))
      result.pagination.totalPages = Math.max(1, Math.ceil(maxCategoryCount / pager.pageSize))
      result.pagination.hasNext = pager.page < result.pagination.totalPages
      result.pagination.hasPrev = pager.page > 1

      return {
        success: true,
        data: { ...result, categoryCounts }
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
        category: todoData.category || '默认',
        // 列表按 sortOrder ASC 排，取负值让新待办排在最前（拖拽排序写入的是 0..n-1，仍在新条目之后）
        sortOrder: -Date.now(),
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

  async createTodos(items, uid) {
    try {
      // sortOrder 用同一基准负时间减索引，同批次内保持输入顺序，且整批排在旧数据之前
      const baseSortOrder = -Date.now()
      const statements = items.map((item, index) => this.todoModel.db
        .prepare('INSERT INTO todos (id, uid, title, completed, priority, due_date, category, sort_order, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')
        .bind(
          crypto.randomUUID(),
          uid,
          item.title.trim(),
          item.completed || 0,
          item.priority || 'medium',
          item.dueDate || null,
          item.category || '默认',
          baseSortOrder - index
        ))
      await this.todoModel.db.batch(statements)
      return { success: true, data: { created: items.length } }
    } catch (error) {
      console.error('批量创建待办事项失败:', error)
      return { success: false, error: '批量创建待办事项失败' }
    }
  }

  async updateTodo(id, todoData, uid) {
    try {
      const updateData = {}
      if (todoData.title !== undefined) updateData.title = todoData.title.trim()
      if (todoData.completed !== undefined) updateData.completed = todoData.completed
      if (todoData.priority !== undefined) updateData.priority = todoData.priority
      if (todoData.dueDate !== undefined) updateData.dueDate = todoData.dueDate
      if (todoData.category !== undefined) updateData.category = todoData.category

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

  async reorderTodos(items, uid) {
    try {
      const ids = items.map(item => item.id)
      const placeholders = ids.map(() => '?').join(', ')
      const existing = await this.todoModel.db
        .prepare(`SELECT id FROM todos WHERE uid = ? AND id IN (${placeholders})`)
        .bind(uid, ...ids)
        .all()
      const existingIds = new Set((existing.results || []).map(row => row.id))
      if (existingIds.size !== ids.length) {
        return { success: false, error: '待办事项不存在或无权限' }
      }

      const statements = items.map(item => this.todoModel.db
        .prepare('UPDATE todos SET sort_order = ?, update_time = CURRENT_TIMESTAMP WHERE id = ? AND uid = ?')
        .bind(item.sortOrder, item.id, uid))
      await this.todoModel.db.batch(statements)
      return { success: true, data: { updated: items.length } }
    } catch (error) {
      console.error('重排待办事项失败:', error)
      return { success: false, error: '重排待办事项失败' }
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
