import { PasswordEntryModel, PasswordGroupModel, QueryBuilder } from '../utils/db.js'

export class PasswordService {
  constructor(db) {
    this.db = db
    this.entryModel = new PasswordEntryModel(db)
    this.groupModel = new PasswordGroupModel(db)
  }

  // ===== 密码分组操作 =====

  // 获取当前用户的所有分组
  async getAllGroups(uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('createTime', 'DESC')

      const groups = await this.groupModel.findAll(queryBuilder)

      // 为每个分组统计密码数量
      const groupIds = groups.map(g => g.id)
      const groupPasswordCounts = {}

      // 获取所有密码条目
      const entriesQueryBuilder = new QueryBuilder().where('uid', '=', uid)
      const allEntries = await this.entryModel.findAll(entriesQueryBuilder)

      // 统计每个分组的密码数量
      allEntries.forEach(entry => {
        const groupId = entry.groupId || 'ungrouped'
        groupPasswordCounts[groupId] = (groupPasswordCounts[groupId] || 0) + 1
      })

      // 将统计信息添加到分组数据中
      const groupsWithCount = groups.map(group => ({
        ...group,
        count: groupPasswordCounts[group.id] || 0
      }))

      return {
        success: true,
        data: groupsWithCount
      }
    } catch (error) {
      console.error('获取密码分组失败:', error)
      return { success: false, error: '获取分组列表失败' }
    }
  }

  // 根据ID获取分组
  async getGroupById(id, uid) {
    try {
      const group = await this.groupModel.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )
      return { success: true, data: group }
    } catch (error) {
      console.error('根据ID获取分组失败:', error)
      return { success: false, error: '获取分组详情失败' }
    }
  }

  // 创建分组
  async createGroup(groupData, uid) {
    try {
      const result = await this.groupModel.create({
        name: groupData.name.trim(),
        color: groupData.color,
        uid: uid
      })
      return {
        success: true,
        data: {
          id: result.id,
          message: '分组创建成功'
        }
      }
    } catch (error) {
      console.error('创建分组失败:', error)
      return { success: false, error: '创建分组失败' }
    }
  }

  // 更新分组
  async updateGroup(id, groupData, uid) {
    try {
      const updateData = {}
      if (groupData.name !== undefined) {
        updateData.name = groupData.name.trim()
      }
      if (groupData.color !== undefined) {
        updateData.color = groupData.color
      }

      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const updateSuccess = await this.groupModel.updateWithQuery(updateData, queryBuilder)
      return {
        success: true,
        data: {
          updated: updateSuccess,
          message: updateSuccess ? '分组更新成功' : '分组不存在或无权限'
        }
      }
    } catch (error) {
      console.error('更新分组失败:', error)
      return { success: false, error: '更新分组失败' }
    }
  }

  // 删除分组
  async deleteGroup(id, uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      // 先删除该分组下的所有密码条目
      const entriesQueryBuilder = new QueryBuilder().where('groupId', '=', id)
      const entries = await this.entryModel.findAll(entriesQueryBuilder)

      for (const entry of entries) {
        const entryQueryBuilder = new QueryBuilder()
          .where('id', '=', entry.id)
          .where('uid', '=', uid)
        await this.entryModel.deleteWithQuery(entryQueryBuilder)
      }

      // 再删除分组
      const deleteSuccess = await this.groupModel.deleteWithQuery(queryBuilder)

      return {
        success: true,
        data: {
          deleted: deleteSuccess,
          deletedEntries: entries.length,
          message: deleteSuccess ? '分组删除成功' : '分组不存在或无权限'
        }
      }
    } catch (error) {
      console.error('删除分组失败:', error)
      return { success: false, error: '删除分组失败' }
    }
  }

  // ===== 密码条目操作 =====

  // 获取当前用户的所有密码条目
  async getAllEntries(uid, options = {}) {
    try {
      const { groupId, page = 1, pageSize = 20, search } = options

      // 构建基础查询条件
      const baseConditions = ['uid = ?']
      const baseParams = [uid]

      // 按分组过滤
      if (groupId !== undefined && groupId !== null && groupId !== 'all') {
        baseConditions.push('group_id = ?')
        baseParams.push(groupId)
      }

      // 搜索条件（在数据库层面使用 LIKE）
      let searchCondition = ''
      let searchParams = []
      if (search && search.trim()) {
        const keyword = `%${search.trim()}%`
        // 在多个字段中搜索：title, username, url, notes
        searchCondition = ` AND (
          title LIKE ? OR
          username LIKE ? OR
          url LIKE ? OR
          notes LIKE ?
        )`
        searchParams = [keyword, keyword, keyword, keyword]
      }

      // 获取总数
      const countSql = `
        SELECT COUNT(*) as count
        FROM password_entries
        WHERE ${baseConditions.join(' AND ')}${searchCondition}
      `
      const countResult = await this.db.prepare(countSql).bind(...baseParams, ...searchParams).first()
      const total = countResult?.count || 0

      // 获取分页数据
      const offset = (page - 1) * pageSize
      const dataSql = `
        SELECT id, uid, title, username, password, url, group_id as groupId, notes,
          create_time || 'Z' as createTime,
          update_time || 'Z' as updateTime
        FROM password_entries
        WHERE ${baseConditions.join(' AND ')}${searchCondition}
        ORDER BY create_time DESC
        LIMIT ? OFFSET ?
      `
      const result = await this.db.prepare(dataSql).bind(...baseParams, ...searchParams, pageSize, offset).all()

      // 映射字段 - .all() 返回的结果对象，需要访问 .results 属性
      const rawEntries = result.results || []
      console.log('=== 分页调试信息 ===')
      console.log('页码:', page, '每页条数:', pageSize, '偏移量:', offset)
      console.log('COUNT 总数:', total)
      console.log('实际返回行数:', rawEntries.length)
      console.log('期望返回行数:', Math.min(pageSize, total - offset))
      if (rawEntries.length !== Math.min(pageSize, total - offset)) {
        console.warn('!!! 数据不一致 !!!')
        // 输出所有 ID 用于排查
        const allIdsSql = `SELECT id FROM password_entries WHERE ${baseConditions.join(' AND ')}${searchCondition} ORDER BY create_time DESC`
        const allIdsResult = await this.db.prepare(allIdsSql).bind(...baseParams, ...searchParams).all()
        console.log('所有符合条件的 IDs (前30个):', (allIdsResult.results || []).slice(0, 30).map(r => r.id))
      }
      console.log('==================')

      const mappedEntries = rawEntries.map(entry => this.entryModel.mapFromDb(entry))

      return {
        success: true,
        data: {
          list: mappedEntries,
          total: total,
          page: page,
          pageSize: pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    } catch (error) {
      console.error('获取密码条目失败:', error)
      return { success: false, error: '获取密码列表失败' }
    }
  }

  // 根据ID获取密码条目
  async getEntryById(id, uid) {
    try {
      const entry = await this.entryModel.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )
      return { success: true, data: entry }
    } catch (error) {
      console.error('根据ID获取密码条目失败:', error)
      return { success: false, error: '获取密码详情失败' }
    }
  }

  // 创建密码条目
  async createEntry(entryData, uid) {
    try {
      const result = await this.entryModel.create({
        title: entryData.title.trim(),
        username: entryData.username || '',
        password: entryData.password,
        url: entryData.url || '',
        groupId: entryData.groupId || null,
        notes: entryData.notes || '',
        uid: uid
      })
      return {
        success: true,
        data: {
          id: result.id,
          message: '密码条目创建成功'
        }
      }
    } catch (error) {
      console.error('创建密码条目失败:', error)
      return { success: false, error: '创建密码条目失败' }
    }
  }

  // 更新密码条目
  async updateEntry(id, entryData, uid) {
    try {
      const updateData = {}
      if (entryData.title !== undefined) {
        updateData.title = entryData.title.trim()
      }
      if (entryData.username !== undefined) {
        updateData.username = entryData.username
      }
      if (entryData.password !== undefined) {
        updateData.password = entryData.password
      }
      if (entryData.url !== undefined) {
        updateData.url = entryData.url
      }
      if (entryData.groupId !== undefined) {
        updateData.groupId = entryData.groupId || null
      }
      if (entryData.notes !== undefined) {
        updateData.notes = entryData.notes
      }

      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const updateSuccess = await this.entryModel.updateWithQuery(updateData, queryBuilder)
      return {
        success: true,
        data: {
          updated: updateSuccess,
          message: updateSuccess ? '密码条目更新成功' : '密码条目不存在或无权限'
        }
      }
    } catch (error) {
      console.error('更新密码条目失败:', error)
      return { success: false, error: '更新密码条目失败' }
    }
  }

  // 删除密码条目
  async deleteEntry(id, uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const deleteSuccess = await this.entryModel.deleteWithQuery(queryBuilder)
      return {
        success: true,
        data: {
          deleted: deleteSuccess,
          message: deleteSuccess ? '密码条目删除成功' : '密码条目不存在或无权限'
        }
      }
    } catch (error) {
      console.error('删除密码条目失败:', error)
      return { success: false, error: '删除密码条目失败' }
    }
  }

  // 验证主密码（存储在用户数据中）
  async validateMasterPassword(uid, hashedPassword) {
    try {
      // 这里应该从用户表中获取存储的主密码哈希
      // 暂时简化处理，返回成功
      return {
        success: true,
        data: { valid: true }
      }
    } catch (error) {
      console.error('验证主密码失败:', error)
      return { success: false, error: '验证主密码失败' }
    }
  }

  // 导出密码
  async exportEntries(uid) {
    try {
      // 获取所有密码条目
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('createTime', 'DESC')

      const entries = await this.entryModel.findAll(queryBuilder)

      // 获取所有分组
      const groupsQueryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('createTime', 'ASC')

      const groups = await this.groupModel.findAll(groupsQueryBuilder)

      return {
        success: true,
        data: {
          exportDate: new Date().toISOString(),
          version: '1.0',
          groups: groups,
          entries: entries
        }
      }
    } catch (error) {
      console.error('导出密码失败:', error)
      return { success: false, error: '导出密码失败' }
    }
  }

  // 导入密码
  async importEntries(uid, file) {
    try {
      // 读取文件内容
      const text = await file.text()
      const data = JSON.parse(text)

      // 验证数据格式
      if (!data.entries || !Array.isArray(data.entries)) {
        return { success: false, error: '导入文件格式错误' }
      }

      let successCount = 0
      let failedCount = 0

      // 导入分组
      if (data.groups && Array.isArray(data.groups)) {
        for (const group of data.groups) {
          try {
            await this.createGroup({
              name: group.name,
              color: group.color || '#409EFF'
            }, uid)
          } catch (e) {
            console.error('导入分组失败:', group, e)
          }
        }
      }

      // 导入密码条目
      for (const entry of data.entries) {
        try {
          await this.createEntry({
            title: entry.title,
            username: entry.username || '',
            password: entry.password,
            url: entry.url || '',
            groupId: entry.groupId || null,
            notes: entry.notes || ''
          }, uid)
          successCount++
        } catch (e) {
          console.error('导入密码失败:', entry, e)
          failedCount++
        }
      }

      return {
        success: true,
        data: {
          success: successCount,
          failed: failedCount,
          total: successCount + failedCount
        }
      }
    } catch (error) {
      console.error('导入密码失败:', error)
      return { success: false, error: '导入密码失败：' + error.message }
    }
  }
}
