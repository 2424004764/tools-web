import { NoteModel, NoteGroupModel, QueryBuilder } from '../utils/db.js'

export class NotesService {
  constructor(db, env = null, waitUntil = null) {
    this.db = db
    this.noteModel = new NoteModel(db, env, waitUntil)
    this.groupModel = new NoteGroupModel(db, env, waitUntil)
  }

  // ===== 笔记分组操作 =====

  // 获取当前用户的所有分组（含每个分组下的笔记数量）
  async getAllGroups(uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('sortOrder', 'ASC')
        .orderBy('createTime', 'DESC')

      const groups = await this.groupModel.findAll(queryBuilder)

      // 统计每个分组下的笔记数量
      const noteCountByGroup = {}
      let ungroupedCount = 0

      const allNotesQuery = new QueryBuilder().where('uid', '=', uid)
      const allNotes = await this.noteModel.findAll(allNotesQuery)

      allNotes.forEach(note => {
        const groupId = note.groupId || null
        if (groupId === null) {
          ungroupedCount++
        } else {
          noteCountByGroup[groupId] = (noteCountByGroup[groupId] || 0) + 1
        }
      })

      const groupsWithCount = groups.map(group => ({
        ...group,
        count: noteCountByGroup[group.id] || 0
      }))

      return {
        success: true,
        data: {
          groups: groupsWithCount,
          ungroupedCount
        }
      }
    } catch (error) {
      console.error('获取笔记分组失败:', error)
      return { success: false, error: '获取分组列表失败' }
    }
  }

  // 根据ID获取当前用户的分组
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
      // 首分组自动命名为「默认」，避免新建用户没有任何分组可显示
      const existing = await this.groupModel.findAll(
        new QueryBuilder().where('uid', '=', uid)
      )
      const payload = {
        name: existing.length === 0 ? '默认' : (groupData.name || '').trim(),
        color: groupData.color || '#667eea',
        sortOrder: typeof groupData.sortOrder === 'number' ? groupData.sortOrder : existing.length,
        uid: uid
      }
      const result = await this.groupModel.create(payload)
      return {
        success: true,
        data: { id: result.id, message: '分组创建成功' }
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
      if (groupData.sortOrder !== undefined && Number.isInteger(groupData.sortOrder)) {
        updateData.sortOrder = groupData.sortOrder
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

  // 删除分组（组内笔记保留并归入"未分组"）
  async deleteGroup(id, uid) {
    try {
      // 先校验：分组存在且属于当前用户
      const group = await this.groupModel.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )
      if (!group) {
        return { success: false, error: '分组不存在或无权限', status: 404 }
      }
      // 「默认」分组不可删除：避免误删后所有笔记变未分组
      if (group.name === '默认') {
        return { success: false, error: '「默认」分组不可删除', status: 400 }
      }

      // 把组内所有笔记的 group_id 置 NULL（保留笔记）
      const notesQuery = new QueryBuilder()
        .where('groupId', '=', id)
        .where('uid', '=', uid)
      await this.noteModel.updateWithQuery({ groupId: null }, notesQuery)

      // 再删除分组
      const deleteSuccess = await this.groupModel.deleteWithQuery(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )

      return {
        success: true,
        data: {
          deleted: deleteSuccess,
          message: deleteSuccess ? '分组删除成功' : '分组不存在或无权限'
        }
      }
    } catch (error) {
      console.error('删除分组失败:', error)
      return { success: false, error: '删除分组失败' }
    }
  }

  // ===== 笔记操作 =====

  // 获取当前用户的所有笔记（支持分页 + 按分组过滤）
  // filters.groupId:
  //   - 'all' / undefined: 不过滤
  //   - 'ungrouped': 仅 group_id IS NULL
  //   - 具体 id: 仅 group_id = 该 id
  async getAllNotes(uid, pager, filters = {}) {
    try {
      const { groupId } = filters

      // 构建 count 查询
      const countBuilder = new QueryBuilder().where('uid', '=', uid)
      const dataBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('createTime', 'DESC')

      if (groupId === 'ungrouped') {
        countBuilder.where('groupId', 'IS', null)
        dataBuilder.where('groupId', 'IS', null)
      } else if (groupId && groupId !== 'all') {
        countBuilder.where('groupId', '=', groupId)
        dataBuilder.where('groupId', '=', groupId)
      }

      pager.applyTo(dataBuilder)

      const total = await this.noteModel.count(countBuilder)
      const notes = await this.noteModel.findAll(dataBuilder)

      return {
        success: true,
        data: pager.createResult(notes, total)
      }
    } catch (error) {
      console.error('获取用户笔记失败:', error)
      return { success: false, error: '获取笔记列表失败' }
    }
  }

  // 根据ID获取当前用户的笔记
  async getNoteById(id, uid) {
    try {
      const note = await this.noteModel.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )
      return { success: true, data: note }
    } catch (error) {
      console.error('根据ID获取用户笔记失败:', error)
      return { success: false, error: '获取笔记详情失败' }
    }
  }

  // 为当前用户创建笔记
  async createNote(noteData, uid) {
    try {
      // 若指定了 groupId，校验它属于当前用户
      let validGroupId = null
      if (noteData.groupId) {
        const group = await this.groupModel.findOne(
          new QueryBuilder()
            .where('id', '=', noteData.groupId)
            .where('uid', '=', uid)
        )
        if (!group) {
          return { success: false, error: '所选分组不存在或无权限' }
        }
        validGroupId = group.id
      } else {
        // 未指定分组：自动归入用户的「默认」分组（若存在）
        const defaultGroup = await this.groupModel.findOne(
          new QueryBuilder()
            .where('uid', '=', uid)
            .where('name', '=', '默认')
        )
        if (defaultGroup) validGroupId = defaultGroup.id
      }

      const result = await this.noteModel.create({
        title: noteData.title.trim(),
        content: noteData.content.trim(),
        groupId: validGroupId,
        uid: uid
      })
      return {
        success: true,
        data: {
          id: result.id,
          message: '笔记创建成功'
        }
      }
    } catch (error) {
      console.error('创建用户笔记失败:', error)
      return { success: false, error: '创建笔记失败' }
    }
  }

  // 更新当前用户的笔记
  async updateNote(id, noteData, uid) {
    try {
      const updateData = {}
      if (noteData.title !== undefined) {
        updateData.title = noteData.title.trim()
      }
      if (noteData.content !== undefined) {
        updateData.content = noteData.content.trim()
      }
      // groupId 允许三种语义：undefined(不改)、具体id(切换)、null(移到未分组)
      if (noteData.groupId !== undefined) {
        if (noteData.groupId === null) {
          updateData.groupId = null
        } else {
          const group = await this.groupModel.findOne(
            new QueryBuilder()
              .where('id', '=', noteData.groupId)
              .where('uid', '=', uid)
          )
          if (!group) {
            return { success: false, error: '所选分组不存在或无权限' }
          }
          updateData.groupId = group.id
        }
      }

      // 只更新属于当前用户的笔记
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const updateSuccess = await this.noteModel.updateWithQuery(updateData, queryBuilder)
      return {
        success: true,
        data: {
          updated: updateSuccess,
          message: updateSuccess ? '笔记更新成功' : '笔记不存在或无权限，未执行更新'
        }
      }
    } catch (error) {
      console.error('更新用户笔记失败:', error)
      return { success: false, error: '更新笔记失败' }
    }
  }

  // 删除当前用户的笔记
  async deleteNote(id, uid) {
    try {
      // 只删除属于当前用户的笔记
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const deleteSuccess = await this.noteModel.deleteWithQuery(queryBuilder)
      return {
        success: true,
        data: {
          deleted: deleteSuccess,
          message: deleteSuccess ? '笔记删除成功' : '笔记不存在或无权限，无需删除'
        }
      }
    } catch (error) {
      console.error('删除用户笔记失败:', error)
      return { success: false, error: '删除笔记失败' }
    }
  }
}