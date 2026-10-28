import { MockSchemaModel, QueryBuilder } from '../utils/db.js'

export class MockSchemasService {
  constructor(db, env = null, waitUntil = null) {
    this.model = new MockSchemaModel(db, env, waitUntil)
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
        uid: uid,
        isPublic: uid ? (data.isPublic ? 1 : 0) : 0
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
      if (data.isPublic !== undefined) updateData.isPublic = data.isPublic ? 1 : 0
      if (uid === null && updateData.isPublic) {
        return { success: false, error: '请登录后才能公开配方' }
      }

      // 构建查询条件：只允许登录用户修改自己的配方；匿名配方不可更新
      const queryBuilder = new QueryBuilder().where('id', '=', id)

      if (uid === null) {
        return { success: false, error: '匿名配方不支持云端更新' }
      }
      queryBuilder.where('uid', '=', uid)

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
