import { LinkModel, QueryBuilder } from '../utils/db.js'

export class LinksService {
  constructor(db) {
    this.linkModel = new LinkModel(db)
  }

  generateSlug(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let slug = ''
    for (let i = 0; i < length; i++) {
      slug += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return slug
  }

  async generateUniqueSlug(length = 6) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const slug = this.generateSlug(length)
      const existing = await this.linkModel.findBySlug(slug)
      if (!existing) return slug
    }
    // 如果冲突太多，尝试更长
    return this.generateUniqueSlug(length + 1)
  }

  async createLink(data, uid = null) {
    try {
      const { url, slug: customSlug, title, expireAt } = data

      if (!url) {
        return { success: false, error: '请输入链接' }
      }

      if (!/^(https?:\/\/)?([\w-]+\.)+\w+/i.test(url) && url !== 'localhost') {
        return { success: false, error: '请输入有效的链接或域名' }
      }

      let slug = customSlug
      if (slug) {
        // 验证自定义 slug
        if (!/^[a-zA-Z0-9_-]{3,32}$/.test(slug)) {
          return { success: false, error: '自定义后缀仅支持字母、数字、下划线和连字符，长度3-32位' }
        }
        const existing = await this.linkModel.findBySlug(slug)
        if (existing) {
          return { success: false, error: '该短链接后缀已被使用，请换一个' }
        }
      } else {
        slug = await this.generateUniqueSlug()
      }

      const now = new Date().toISOString()
      const linkData = {
        id: crypto.randomUUID(),
        slug,
        url,
        title: title || '',
        uid: uid || '',
        clicks: 0,
        expireAt: expireAt || null,
        createTime: now,
        updateTime: now
      }

      await this.linkModel.create(linkData)

      return { success: true, data: { slug, url, title: linkData.title } }
    } catch (error) {
      console.error('LinksService createLink error:', error)
      return { success: false, error: '创建短链接失败' }
    }
  }

  async getLink(slug) {
    try {
      const link = await this.linkModel.findBySlug(slug)
      if (!link) return { success: false, error: '短链接不存在' }

      // 检查是否过期
      if (link.expireAt && new Date(link.expireAt) < new Date()) {
        return { success: false, error: '短链接已过期' }
      }

      return { success: true, data: link }
    } catch (error) {
      console.error('LinksService getLink error:', error)
      return { success: false, error: '查询失败' }
    }
  }

  async redirect(slug) {
    const result = await this.getLink(slug)
    if (!result.success) return result

    // 异步增加点击数
    this.linkModel.incrementClicks(slug).catch(() => {})

    return { success: true, data: result.data }
  }

  async listLinks(uid, pager) {
    try {
      const queryBuilder = new QueryBuilder()
      queryBuilder.where('uid', '=', uid)
      queryBuilder.orderBy('createTime', 'DESC')

      const result = await this.linkModel.paginate(pager.page, pager.pageSize, queryBuilder)
      return { success: true, data: result }
    } catch (error) {
      console.error('LinksService listLinks error:', error)
      return { success: false, error: '查询失败' }
    }
  }

  async deleteLink(slug) {
    try {
      const queryBuilder = new QueryBuilder().where('slug', '=', slug)
      await this.linkModel.deleteWithQuery(queryBuilder)
      return { success: true }
    } catch (error) {
      console.error('LinksService deleteLink error:', error)
      return { success: false, error: '删除失败' }
    }
  }
}
