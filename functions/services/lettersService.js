import { QueryBuilder } from '../utils/db.js'

// Letter Model
class LetterModel {
  constructor(db) {
    this.db = db
    this.config = {
      tableName: 'letters',
      fields: {
        id: { dbField: 'id', type: 'integer' },
        uid: { dbField: 'uid', type: 'text' },
        slug: { dbField: 'slug', type: 'text' },
        title: { dbField: 'title', type: 'text' },
        recipient: { dbField: 'recipient', type: 'text' },
        sender: { dbField: 'sender', type: 'text' },
        style: { dbField: 'style', type: 'text' },
        theme: { dbField: 'theme', type: 'text' },
        content: { dbField: 'content', type: 'text' },
        createTime: { dbField: 'createTime', type: 'integer' }
      }
    }
  }

  mapFromDb(data) {
    const mapped = {}
    for (const [jsField, fieldConfig] of Object.entries(this.config.fields)) {
      const dbField = fieldConfig.dbField || jsField
      if (data[dbField] !== undefined) {
        mapped[jsField] = data[dbField]
      }
    }
    return mapped
  }

  mapToDb(data) {
    const mapped = {}
    for (const [jsField, value] of Object.entries(data)) {
      const fieldConfig = this.config.fields[jsField]
      if (fieldConfig) {
        const dbField = fieldConfig.dbField || jsField
        mapped[dbField] = value
      }
    }
    return mapped
  }

  async create(data) {
    const mappedData = this.mapToDb(data)
    const fields = Object.keys(mappedData)
    const placeholders = fields.map(() => '?').join(', ')
    const values = Object.values(mappedData)

    const sql = `INSERT INTO ${this.config.tableName} (${fields.join(', ')}) VALUES (${placeholders})`
    const result = await this.db.prepare(sql).bind(...values).run()

    return { id: result.meta.last_row_id, success: true }
  }

  async findAll(queryBuilder) {
    let sql = `SELECT * FROM ${this.config.tableName}`
    let params = []

    if (queryBuilder) {
      const whereClause = queryBuilder.buildWhere(this)
      sql += whereClause.sql
      params = whereClause.params

      sql += queryBuilder.buildOrderBy(this)
      sql += queryBuilder.buildLimit()
    }

    const result = await this.db.prepare(sql).bind(...params).all()
    return result.results.map(row => this.mapFromDb(row))
  }

  async findOne(queryBuilder) {
    const whereClause = queryBuilder.buildWhere(this)
    let sql = `SELECT * FROM ${this.config.tableName}${whereClause.sql} LIMIT 1`

    const result = await this.db.prepare(sql).bind(...whereClause.params).first()
    return result ? this.mapFromDb(result) : null
  }

  async count(queryBuilder) {
    let sql = `SELECT COUNT(*) as count FROM ${this.config.tableName}`
    let params = []

    if (queryBuilder) {
      const whereClause = queryBuilder.buildWhere(this)
      sql += whereClause.sql
      params = whereClause.params
    }

    const result = await this.db.prepare(sql).bind(...params).first()
    return result.count
  }

  async deleteWithQuery(queryBuilder) {
    const whereClause = queryBuilder.buildWhere(this)
    const sql = `DELETE FROM ${this.config.tableName}${whereClause.sql}`

    const result = await this.db.prepare(sql).bind(...whereClause.params).run()
    return (result.meta?.changes ?? result.changes ?? 0) > 0
  }
}

export class LettersService {
  constructor(db) {
    this.letterModel = new LetterModel(db)
  }

  // 生成唯一 slug
  generateSlug() {
    return Math.random().toString(36).substring(2, 10)
  }

  // 创建信件
  async createLetter(letterData, uid) {
    try {
      // 生成唯一 slug
      let slug = this.generateSlug()

      // 检查 slug 是否已存在，如果存在则重新生成
      let existing = await this.letterModel.findOne(
        new QueryBuilder().where('slug', '=', slug)
      )

      while (existing) {
        slug = this.generateSlug()
        existing = await this.letterModel.findOne(
          new QueryBuilder().where('slug', '=', slug)
        )
      }

      const result = await this.letterModel.create({
        uid: uid,
        slug: slug,
        title: letterData.title.trim(),
        recipient: letterData.recipient.trim(),
        sender: letterData.sender.trim(),
        style: letterData.style,
        theme: letterData.theme,
        content: letterData.content.trim(),
        createTime: Date.now()
      })

      return {
        success: true,
        data: {
          id: result.id,
          slug: slug,
          message: '信件创建成功'
        }
      }
    } catch (error) {
      console.error('创建信件失败:', error)
      return { success: false, error: '创建信件失败' }
    }
  }

  // 根据 slug 获取信件（公开访问）
  async getLetterBySlug(slug) {
    try {
      const letter = await this.letterModel.findOne(
        new QueryBuilder().where('slug', '=', slug)
      )

      if (!letter) {
        return { success: false, error: '信件不存在' }
      }

      return { success: true, data: letter }
    } catch (error) {
      console.error('获取信件失败:', error)
      return { success: false, error: '获取信件失败' }
    }
  }

  // 获取当前用户的所有信件（支持分页）
  async getAllLetters(uid, pager) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('createTime', 'DESC')

      // 应用分页
      pager.applyTo(queryBuilder)

      // 获取总数和数据
      const countQuery = new QueryBuilder().where('uid', '=', uid)
      const total = await this.letterModel.count(countQuery)
      const letters = await this.letterModel.findAll(queryBuilder)

      return {
        success: true,
        data: pager.createResult(letters, total)
      }
    } catch (error) {
      console.error('获取用户信件失败:', error)
      return { success: false, error: '获取信件列表失败' }
    }
  }

  // 删除当前用户的信件
  async deleteLetter(id, uid) {
    try {
      // 只删除属于当前用户的信件
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const deleteSuccess = await this.letterModel.deleteWithQuery(queryBuilder)
      return {
        success: true,
        data: {
          deleted: deleteSuccess,
          message: deleteSuccess ? '信件删除成功' : '信件不存在或无权限，无需删除'
        }
      }
    } catch (error) {
      console.error('删除信件失败:', error)
      return { success: false, error: '删除信件失败' }
    }
  }
}
