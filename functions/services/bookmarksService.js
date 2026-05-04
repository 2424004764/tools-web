import { BookmarkModel, QueryBuilder } from '../utils/db.js'

export class BookmarksService {
  constructor(db) {
    this.bookmarkModel = new BookmarkModel(db)
  }

  // 获取当前用户的所有书签（支持分页）
  async getAllBookmarks(uid, pager) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('updateTime', 'DESC')

      pager.applyTo(queryBuilder)

      const countQuery = new QueryBuilder().where('uid', '=', uid)
      const total = await this.bookmarkModel.count(countQuery)
      const bookmarks = await this.bookmarkModel.findAll(queryBuilder)

      return {
        success: true,
        data: pager.createResult(bookmarks, total)
      }
    } catch (error) {
      console.error('获取用户书签失败:', error)
      return { success: false, error: '获取书签列表失败' }
    }
  }

  // 根据ID获取当前用户的书签
  async getBookmarkById(id, uid) {
    try {
      const bookmark = await this.bookmarkModel.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )
      return { success: true, data: bookmark }
    } catch (error) {
      console.error('根据ID获取用户书签失败:', error)
      return { success: false, error: '获取书签详情失败' }
    }
  }

  // 为当前用户创建书签
  async createBookmark(bookmarkData, uid) {
    try {
      const tags = Array.isArray(bookmarkData.tags) ? bookmarkData.tags : []
      const now = new Date().toISOString()
      const result = await this.bookmarkModel.create({
        url: bookmarkData.url.trim(),
        title: bookmarkData.title.trim(),
        description: bookmarkData.description ? bookmarkData.description.trim() : '',
        tags: JSON.stringify(tags),
        isRead: bookmarkData.isRead ? 1 : 0,
        uid: uid,
        createTime: now,
        updateTime: now,
      })
      return {
        success: true,
        data: {
          id: result.id,
          message: '书签创建成功'
        }
      }
    } catch (error) {
      console.error('创建用户书签失败:', error)
      return { success: false, error: '创建书签失败' }
    }
  }

  // 更新当前用户的书签
  async updateBookmark(id, bookmarkData, uid) {
    try {
      const updateData = {}
      if (bookmarkData.url !== undefined) {
        updateData.url = bookmarkData.url.trim()
      }
      if (bookmarkData.title !== undefined) {
        updateData.title = bookmarkData.title.trim()
      }
      if (bookmarkData.description !== undefined) {
        updateData.description = bookmarkData.description.trim()
      }
      if (bookmarkData.tags !== undefined) {
        updateData.tags = JSON.stringify(
          Array.isArray(bookmarkData.tags) ? bookmarkData.tags : []
        )
      }
      if (bookmarkData.isRead !== undefined) {
        updateData.isRead = bookmarkData.isRead ? 1 : 0
      }

      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const updateSuccess = await this.bookmarkModel.updateWithQuery(updateData, queryBuilder)
      return {
        success: true,
        data: {
          updated: updateSuccess,
          message: updateSuccess ? '书签更新成功' : '书签不存在或无权限，未执行更新'
        }
      }
    } catch (error) {
      console.error('更新用户书签失败:', error)
      return { success: false, error: '更新书签失败' }
    }
  }

  // 删除当前用户的书签
  async deleteBookmark(id, uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const deleteSuccess = await this.bookmarkModel.deleteWithQuery(queryBuilder)
      return {
        success: true,
        data: {
          deleted: deleteSuccess,
          message: deleteSuccess ? '书签删除成功' : '书签不存在或无权限，无需删除'
        }
      }
    } catch (error) {
      console.error('删除用户书签失败:', error)
      return { success: false, error: '删除书签失败' }
    }
  }
}
