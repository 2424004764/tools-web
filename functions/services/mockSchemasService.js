import { MockSchemaModel, QueryBuilder } from '../utils/db.js'

export class MockSchemasService {
  constructor(db) {
    this.model = new MockSchemaModel(db)
  }

  async getAllSchemas(uid, pager) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('updateTime', 'DESC')

      pager.applyTo(queryBuilder)

      const countQuery = new QueryBuilder().where('uid', '=', uid)
      const total = await this.model.count(countQuery)
      const items = await this.model.findAll(queryBuilder)

      return { success: true, data: pager.createResult(items, total) }
    } catch (error) {
      console.error('获取 mock 配方失败:', error)
      return { success: false, error: '获取 mock 配方列表失败' }
    }
  }

  async getSchemaById(id, uid) {
    try {
      const item = await this.model.findOne(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: item }
    } catch (error) {
      console.error('根据ID获取 mock 配方失败:', error)
      return { success: false, error: '获取 mock 配方详情失败' }
    }
  }

  async createSchema(data, uid) {
    try {
      const fields = Array.isArray(data.schema) ? data.schema : []
      const result = await this.model.create({
        name: (data.name || '').trim(),
        description: data.description ? data.description.trim() : '',
        schema: JSON.stringify(fields),
        uid: uid
      })

      // 返回完整的配方对象（包含 uid），以便前端立即生成链接
      const createdSchema = await this.model.findById(result.id)

      return {
        success: true,
        data: createdSchema || { id: result.id, message: 'mock 配方创建成功' }
      }
    } catch (error) {
      console.error('创建 mock 配方失败:', error)
      return { success: false, error: '创建 mock 配方失败' }
    }
  }

  async updateSchema(id, data, uid) {
    try {
      const updateData = {}
      if (data.name !== undefined) updateData.name = (data.name || '').trim()
      if (data.description !== undefined) {
        updateData.description = data.description ? data.description.trim() : ''
      }
      if (data.schema !== undefined) {
        updateData.schema = JSON.stringify(Array.isArray(data.schema) ? data.schema : [])
      }

      // 构建查询条件：匿名配方（uid 为 null）或用户自己的配方
      const queryBuilder = new QueryBuilder().where('id', '=', id)

      if (uid === null) {
        // 匿名配方：uid IS NULL
        queryBuilder.where('uid', 'IS', null)
      } else {
        // 用户配方：uid = user.id
        queryBuilder.where('uid', '=', uid)
      }

      const ok = await this.model.updateWithQuery(updateData, queryBuilder)
      return {
        success: true,
        data: {
          updated: ok,
          message: ok ? 'mock 配方更新成功' : 'mock 配方不存在或无权限，未执行更新'
        }
      }
    } catch (error) {
      console.error('更新 mock 配方失败:', error)
      return { success: false, error: '更新 mock 配方失败' }
    }
  }

  async deleteSchema(id, uid) {
    try {
      const queryBuilder = new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      const ok = await this.model.deleteWithQuery(queryBuilder)
      return {
        success: true,
        data: {
          deleted: ok,
          message: ok ? 'mock 配方删除成功' : 'mock 配方不存在或无权限，无需删除'
        }
      }
    } catch (error) {
      console.error('删除 mock 配方失败:', error)
      return { success: false, error: '删除 mock 配方失败' }
    }
  }
}
