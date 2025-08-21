import { NoteModel, QueryBuilder } from '../utils/db.js'

export class NotesService {
  constructor(db) {
    this.noteModel = new NoteModel(db)
  }

  // 获取当前用户的所有笔记
  async getAllNotes(uid) {
    try {
      const notes = await this.noteModel.findAll(
        new QueryBuilder()
          .where('uid', '=', uid)
          .orderBy('createTime', 'DESC')
      )
      return { success: true, data: notes }
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
      const result = await this.noteModel.create({
        title: noteData.title.trim(),
        content: noteData.content.trim(),
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
