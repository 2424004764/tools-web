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
        let value = data[dbField]
        // 处理时间字段：添加 UTC 时区标记
        if (fieldConfig.type === 'datetime' && value && typeof value === 'string' && !value.endsWith('Z')) {
          value = value + 'Z'
        }
        mapped[jsField] = value
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

// Company 模型 - 公司对比模型
export class CompanyModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'companies',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' }, // 用户ID
        name: { type: 'string' }, // 公司名称
        position: { type: 'string' }, // 职位
        salary: { type: 'string' }, // 薪资
        benefits: { type: 'text' }, // 福利待遇
        workDays: { type: 'string', dbField: 'work_days' }, // 工作日
        workHours: { type: 'string', dbField: 'work_hours' }, // 工作时间
        location: { type: 'string' }, // 工作地点
        welfare: { type: 'text' }, // 其他福利
        overtime: { type: 'string' }, // 加班情况
        leavePolicy: { type: 'string', dbField: 'leave_policy' }, // 请假政策
        notes: { type: 'text' }, // 备注
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

// PasswordEntry 模型 - 密码条目模型
export class PasswordEntryModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'password_entries',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' }, // 用户ID
        title: { type: 'string' }, // 标题
        username: { type: 'string' }, // 用户名
        password: { type: 'string' }, // 加密后的密码
        url: { type: 'string' }, // 网站URL
        groupId: { type: 'string', dbField: 'group_id' }, // 分组ID
        notes: { type: 'text' }, // 备注
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// PasswordGroup 模型 - 密码分组模型
export class PasswordGroupModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'password_groups',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' }, // 用户ID
        name: { type: 'string' }, // 分组名称
        color: { type: 'string' }, // 分组颜色
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// Todo 模型 - 待办事项模型
export class TodoModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'todos',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        title: { type: 'string' },
        completed: { type: 'integer' },
        priority: { type: 'string' },
        dueDate: { type: 'string', dbField: 'due_date' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// QA 模型 - QA问答页面模型
export class QAModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'qa_pages',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' }, // 用户ID
        title: { type: 'string' }, // QA页面标题
        qaItems: { type: 'json', dbField: 'qa_items' }, // 问答对列表，JSON格式存储
        headerContent: { type: 'text', dbField: 'header_content' }, // 头部自定义内容
        footerContent: { type: 'text', dbField: 'footer_content' }, // 尾部自定义内容
        isPublic: { type: 'boolean', dbField: 'is_public' }, // 是否公开
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }

  // 生成UUID
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  // 重写create方法以处理JSON数据
  async create(data) {
    try {
      const id = this.generateId()
      const now = new Date().toISOString()
      
      // 处理qaItems JSON序列化
      const qaItemsJson = data.qaItems ? JSON.stringify(data.qaItems) : '[]'
      
      const insertData = {
        id,
        uid: data.uid,
        title: data.title,
        qa_items: qaItemsJson,
        header_content: data.headerContent || '',
        footer_content: data.footerContent || '',
        is_public: data.isPublic ? 1 : 0,
        create_time: now,
        update_time: now
      }

      const fields = Object.keys(insertData)
      const placeholders = fields.map(() => '?').join(', ')
      const values = fields.map(field => insertData[field])

      const sql = `INSERT INTO ${this.config.tableName} (${fields.join(', ')}) VALUES (${placeholders})`
      
      await this.db.prepare(sql).bind(...values).run()
      
      return { success: true, id }
    } catch (error) {
      console.error('QAModel create error:', error)
      return { success: false, error: error.message }
    }
  }

  // 重写update方法以处理JSON数据
  async update(id, data) {
    try {
      console.log('QAModel update called with:', { id, data })
      
      const now = new Date().toISOString()
      
      // 处理qaItems JSON序列化
      const qaItemsJson = data.qaItems ? JSON.stringify(data.qaItems) : '[]'
      console.log('Serialized qaItems:', qaItemsJson)
      
      const updateFields = []
      const values = []
      
      if (data.title !== undefined) {
        updateFields.push('title = ?')
        values.push(data.title)
      }
      
      if (data.qaItems !== undefined) {
        updateFields.push('qa_items = ?')
        values.push(qaItemsJson)
      }
      
      if (data.headerContent !== undefined) {
        updateFields.push('header_content = ?')
        values.push(data.headerContent)
      }
      
      if (data.footerContent !== undefined) {
        updateFields.push('footer_content = ?')
        values.push(data.footerContent)
      }
      
      if (data.isPublic !== undefined) {
        updateFields.push('is_public = ?')
        values.push(data.isPublic ? 1 : 0)
      }
      
      updateFields.push('update_time = ?')
      values.push(now)
      values.push(id)

      const sql = `UPDATE ${this.config.tableName} SET ${updateFields.join(', ')} WHERE id = ?`
      console.log('Update SQL:', sql)
      console.log('Update values:', values)
      
      const result = await this.db.prepare(sql).bind(...values).run()
      console.log('Update result:', result)
      
      // 修复：检查正确的changes字段
      const changes = result.meta?.changes ?? result.changes ?? 0
      console.log('Changes count:', changes)
      
      return changes > 0
    } catch (error) {
      console.error('QAModel update error:', error)
      return false
    }
  }

  // 重写findById方法以处理JSON数据反序列化
  async findById(id) {
    try {
      const sql = `SELECT * FROM ${this.config.tableName} WHERE id = ?`
      const result = await this.db.prepare(sql).bind(id).first()
      
      if (!result) {
        return null
      }

      // 反序列化JSON数据，添加错误处理
      let qaItems = []
      try {
        if (result.qa_items && typeof result.qa_items === 'string') {
          qaItems = JSON.parse(result.qa_items)
        } else if (Array.isArray(result.qa_items)) {
          qaItems = result.qa_items
        }
      } catch (error) {
        console.error('Error parsing qa_items:', error, 'Raw data:', result.qa_items)
        qaItems = []
      }
      
      return {
        id: result.id,
        uid: result.uid,
        title: result.title,
        qaItems: qaItems,
        headerContent: result.header_content || '',
        footerContent: result.footer_content || '',
        isPublic: Boolean(result.is_public),
        createTime: result.create_time,
        updateTime: result.update_time
      }
    } catch (error) {
      console.error('QAModel findById error:', error)
      return null
    }
  }

  // 重写find方法以处理JSON数据反序列化
  async find(queryBuilder) {
    try {
      const { sql: whereSql, params: whereParams } = queryBuilder.buildWhere(this)
      const { sql: orderSql } = queryBuilder.buildOrderBy()
      const { sql: limitSql, params: limitParams } = queryBuilder.buildLimit()
      
      let sql = `SELECT * FROM ${this.config.tableName}`
      let params = []
      
      if (whereSql) {
        sql += ` WHERE ${whereSql}`
        params = [...whereParams]
      }
      
      if (orderSql) {
        sql += ` ${orderSql}`
      }
      
      if (limitSql) {
        sql += ` ${limitSql}`
        params = [...params, ...limitParams]
      }
      
      const results = await this.db.prepare(sql).bind(...params).all()
      console.log('Raw database results:', results)
      
      return results.map(result => {
        console.log('Processing result:', result)
        console.log('qa_items type:', typeof result.qa_items)
        console.log('qa_items value:', result.qa_items)
        
        // 反序列化JSON数据，添加错误处理
        let qaItems = []
        try {
          if (result.qa_items && typeof result.qa_items === 'string') {
            qaItems = JSON.parse(result.qa_items)
            console.log('Parsed qaItems:', qaItems)
          } else if (Array.isArray(result.qa_items)) {
            qaItems = result.qa_items
            console.log('Using existing array:', qaItems)
          }
        } catch (error) {
          console.error('Error parsing qa_items:', error, 'Raw data:', result.qa_items)
          qaItems = []
        }
        
        const finalResult = {
          id: result.id,
          uid: result.uid,
          title: result.title,
          qaItems: qaItems,
          headerContent: result.header_content || '',
          footerContent: result.footer_content || '',
          isPublic: Boolean(result.is_public),
          createTime: result.create_time,
          updateTime: result.update_time
        }
        
        console.log('Final result:', finalResult)
        return finalResult
      })
    } catch (error) {
      console.error('QAModel find error:', error)
      return []
    }
  }

  // 重写findAll方法以处理JSON数据反序列化
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
    
    const results = await this.db.prepare(sql).bind(...params).all()
    console.log('findAll results:', results)
    console.log('results type:', typeof results)
    console.log('results is array:', Array.isArray(results))
    
    // 确保results是数组
    const resultsArray = Array.isArray(results) ? results : (results.results || [])
    
    return resultsArray.map(result => {
      console.log('Processing result:', result)
      console.log('qa_items type:', typeof result.qa_items)
      console.log('qa_items value:', result.qa_items)
      
      // 反序列化JSON数据，添加错误处理
      let qaItems = []
      try {
        if (result.qa_items && typeof result.qa_items === 'string') {
          qaItems = JSON.parse(result.qa_items)
          console.log('Parsed qaItems:', qaItems)
        } else if (Array.isArray(result.qa_items)) {
          qaItems = result.qa_items
          console.log('Using existing array:', qaItems)
        }
      } catch (error) {
        console.error('Error parsing qa_items:', error, 'Raw data:', result.qa_items)
        qaItems = []
      }
      
      const finalResult = {
        id: result.id,
        uid: result.uid,
        title: result.title,
        qaItems: qaItems,
        headerContent: result.header_content || '',
        footerContent: result.footer_content || '',
        isPublic: Boolean(result.is_public),
        createTime: result.create_time,
        updateTime: result.update_time
      }
      
      console.log('Final result:', finalResult)
      return finalResult
    })
  }
}