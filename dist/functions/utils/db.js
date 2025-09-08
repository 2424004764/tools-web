import { getCORSHeaders } from './cors.js'

// 查询构建器
export class QueryBuilder {
  constructor() {
    this.whereConditions = []
    this.orderByConditions = []
    this.limitValue = undefined
    this.offsetValue = undefined
  }

  where(field, operator, value) {
    this.whereConditions.push({ field, operator, value })
    return this
  }

  orderBy(field, direction = 'ASC') {
    this.orderByConditions.push({ field, direction })
    return this
  }

  limit(limit) {
    this.limitValue = limit
    return this
  }

  offset(offset) {
    this.offsetValue = offset
    return this
  }

  buildWhere(model) {
    if (this.whereConditions.length === 0) {
      return { sql: '', params: [] }
    }

    const conditions = []
    const params = []

    this.whereConditions.forEach(condition => {
      const dbField = model.config.fields[condition.field]?.dbField || condition.field
      
      if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
        const placeholders = Array(condition.value.length).fill('?').join(', ')
        conditions.push(`${dbField} ${condition.operator} (${placeholders})`)
        params.push(...condition.value)
      } else {
        conditions.push(`${dbField} ${condition.operator} ?`)
        params.push(condition.value)
      }
    })

    return {
      sql: ` WHERE ${conditions.join(' AND ')}`,
      params
    }
  }

  buildOrderBy(model) {
    if (this.orderByConditions.length === 0) {
      return ''
    }

    const orderClauses = this.orderByConditions.map(order => {
      const dbField = model.config.fields[order.field]?.dbField || order.field
      return `${dbField} ${order.direction}`
    })

    return ` ORDER BY ${orderClauses.join(', ')}`
  }

  buildLimit() {
    let sql = ''
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`
    }
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`
    }
    return sql
  }
}

// 数据库模型基类
export class Model {
  constructor(db) {
    this.db = db
  }

  // 字段映射：数据库字段名 -> JS字段名
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

  // 字段映射：JS字段名 -> 数据库字段名
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

  // 创建记录
  async create(data) {
    const mappedData = this.mapToDb(data)
    
    // 添加ID（如果没有提供）
    if (!mappedData.id) {
      mappedData.id = crypto.randomUUID()
    }
    
    const fields = Object.keys(mappedData)
    const placeholders = fields.map(() => '?').join(', ')
    const values = Object.values(mappedData)
    
    const sql = `INSERT INTO ${this.config.tableName} (${fields.join(', ')}) VALUES (${placeholders})`
    
    await this.db.prepare(sql).bind(...values).run()
    
    return { id: mappedData.id, success: true }
  }

  // 查询所有记录
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

  // 查询单条记录
  async findOne(queryBuilder) {
    const whereClause = queryBuilder.buildWhere(this)
    
    let sql = `SELECT * FROM ${this.config.tableName}${whereClause.sql} LIMIT 1`
    
    const result = await this.db.prepare(sql).bind(...whereClause.params).first()
    return result ? this.mapFromDb(result) : null
  }

  // 根据ID查询
  async findById(id) {
    return this.findOne(new QueryBuilder().where('id', '=', id))
  }

  // 更新记录
  async update(id, data) {
    const mappedData = this.mapToDb(data)
    
    const fields = Object.keys(mappedData)
    const setClause = fields.map(field => `${field} = ?`).join(', ')
    const values = [...Object.values(mappedData), id]
    
    // 添加更新时间
    const updateTimeField = this.config.fields.updateTime?.dbField || 'update_time'
    const sql = `UPDATE ${this.config.tableName} SET ${setClause}, ${updateTimeField} = CURRENT_TIMESTAMP WHERE id = ?`
    
    const result = await this.db.prepare(sql).bind(...values).run()
    return (result.meta?.changes ?? result.changes ?? 0) > 0
  }

  // 使用查询构建器更新记录
  async updateWithQuery(data, queryBuilder) {
    const mappedData = this.mapToDb(data)
    const whereClause = queryBuilder.buildWhere(this)
    
    const fields = Object.keys(mappedData)
    const setClause = fields.map(field => `${field} = ?`).join(', ')
    const values = [...Object.values(mappedData), ...whereClause.params]
    
    const updateTimeField = this.config.fields.updateTime?.dbField || 'update_time'
    const sql = `UPDATE ${this.config.tableName} SET ${setClause}, ${updateTimeField} = CURRENT_TIMESTAMP${whereClause.sql}`
    
    const result = await this.db.prepare(sql).bind(...values).run()
    return (result.meta?.changes ?? result.changes ?? 0) > 0
  }

  // 删除记录
  async delete(id) {
    const sql = `DELETE FROM ${this.config.tableName} WHERE id = ?`
    
    const result = await this.db.prepare(sql).bind(id).run()
    return (result.meta?.changes ?? result.changes ?? 0) > 0
  }

  // 使用查询构建器删除记录
  async deleteWithQuery(queryBuilder) {
    const whereClause = queryBuilder.buildWhere(this)
    const sql = `DELETE FROM ${this.config.tableName}${whereClause.sql}`
    
    const result = await this.db.prepare(sql).bind(...whereClause.params).run()
    return (result.meta?.changes ?? result.changes ?? 0) > 0
  }

  // 检查记录是否存在
  async exists(id) {
    const sql = `SELECT 1 FROM ${this.config.tableName} WHERE id = ? LIMIT 1`
    
    const result = await this.db.prepare(sql).bind(id).first()
    return !!result
  }

  // 统计记录数
  async count(queryBuilder) {
    let sql = `SELECT COUNT(*) as count FROM ${this.config.tableName}`
    let params = []
    
    if (queryBuilder) {
      const whereClause = queryBuilder.buildWhere(this)
      sql += whereClause.sql
      params = whereClause.params
    }
    
    const result = await this.db.prepare(sql).bind(...params).first()
    return result?.count || 0
  }

  // 分页查询
  async paginate(page = 1, pageSize = 10, queryBuilder) {
    const total = await this.count(queryBuilder)
    const totalPages = Math.ceil(total / pageSize)
    const offset = (page - 1) * pageSize
    
    if (!queryBuilder) {
      queryBuilder = new QueryBuilder()
    }
    queryBuilder.limit(pageSize).offset(offset)
    
    const data = await this.findAll(queryBuilder)
    
    return {
      data,
      total,
      page,
      pageSize,
      totalPages
    }
  }
}

// 用户模型
export class UserModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'user',
      fields: {
        id: { type: 'string', primaryKey: true },
        email: { type: 'string' },
        avatar: { type: 'string' },
        created_at: { type: 'datetime', dbField: 'created_at' },
        last_login: { type: 'datetime', dbField: 'last_login' },
        third_party_uid: { type: 'string', dbField: 'third_party_uid' },
        username: { type: 'string', dbField: 'username' },
        user_level: { type: 'integer', dbField: 'user_level' },
        third_party_type: { type: 'string', dbField: 'third_party_type' }
      }
    }
  }
}

// Note 模型 - 使用uid字段
export class NoteModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'notes',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' }, // 用户ID字段简化为uid
        title: { type: 'string' },
        content: { type: 'string' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// Resume 模型 - 简历模型
export class ResumeModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'resumes',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' }, // 用户ID
        name: { type: 'string' }, // 简历名称
        template: { type: 'string' }, // 简历模板
        personalInfo: { type: 'text', dbField: 'personal_info' }, // 个人信息JSON
        workExperience: { type: 'text', dbField: 'work_experience' }, // 工作经历JSON
        education: { type: 'text' }, // 教育经历JSON
        skills: { type: 'text' }, // 技能JSON
        projects: { type: 'text' }, // 项目经历JSON
        certificates: { type: 'text' }, // 证书JSON
        others: { type: 'text' }, // 其他信息JSON
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// API响应工具
export class ApiResponse {
  static success(data, origin, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders(origin)
      }
    })
  }

  static error(message, origin, status = 500) {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders(origin)
      }
    })
  }

  static cors(origin) {
    return new Response(null, {
      status: 204,
      headers: getCORSHeaders(origin)
    })
  }
}

// 分页工具类
export class Pager {
  constructor(request, defaultPageSize = 10) {
    if (request) {
      const url = new URL(request.url)
      this.page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
      this.pageSize = Math.max(1, parseInt(url.searchParams.get('pageSize')) || defaultPageSize)
    } else {
      this.page = 1
      this.pageSize = defaultPageSize
    }
  }

  // 静态方法：从请求创建分页器
  static fromRequest(request, defaultPageSize = 10) {
    return new Pager(request, defaultPageSize)
  }

  // 静态方法：创建默认分页器
  static default(defaultPageSize = 10) {
    return new Pager(null, defaultPageSize)
  }

  // 获取偏移量
  get offset() {
    return (this.page - 1) * this.pageSize
  }

  // 应用到查询构建器
  applyTo(queryBuilder) {
    return queryBuilder.limit(this.pageSize).offset(this.offset)
  }

  // 创建分页结果
  createResult(data, total) {
    const totalPages = Math.ceil(total / this.pageSize)
    return {
      data,
      pagination: {
        total,
        page: this.page,
        pageSize: this.pageSize,
        totalPages,
        hasNext: this.page < totalPages,
        hasPrev: this.page > 1
      }
    }
  }
}

// 数据库初始化函数 - 公共逻辑
export function initDatabase(env) {
  // 确保D1数据库存在
  if (!env.DB) {
    console.error('D1 database not bound. Please check your Cloudflare Pages configuration.')
    return {
      success: false,
      response: ApiResponse.error('Database not available', 500)
    }
  }
  
  return {
    success: true,
    db: env.DB
  }
}