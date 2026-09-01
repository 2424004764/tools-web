import { getCORSHeaders } from './cors.js'
import { logSlowQuery, shouldLogSlowQuery, parseSqlMeta, DEFAULT_SLOW_QUERY_THRESHOLD_MS } from './slow-query-log.js'

// ===== 安全约束：防止 SQL 注入 =====
const ALLOWED_OPERATORS = new Set([
  '=', '!=', '<>',
  '<', '<=', '>', '>=',
  'LIKE', 'NOT LIKE',
  'IN', 'NOT IN',
  'IS', 'IS NOT',
])
const ALLOWED_DIRECTIONS = new Set(['ASC', 'DESC'])
const MAX_LIMIT = 1000

function assertIntegerInRange(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`QueryBuilder.${name} 必须是 ${min}~${max} 之间的整数，收到：${value}`)
  }
}

function assertFieldExists(model, field) {
  // 强制字段必须在 model.config.fields 中定义，禁止把外部字符串直接当列名拼进 SQL
  if (!model || !model.config || !model.config.fields || !model.config.fields[field]) {
    throw new Error(`QueryBuilder 字段未在 model.config.fields 中注册: ${field}`)
  }
}

function resolveDbField(model, field) {
  assertFieldExists(model, field)
  // JS 字段名 → 数据库列名；若两者同名（无 dbField 配置）则返回原名
  return model.config.fields[field].dbField || field
}

// 查询构建器
export class QueryBuilder {
  constructor() {
    this.whereConditions = []
    this.orderByConditions = []
    this.limitValue = undefined
    this.offsetValue = undefined
  }

  where(field, operator, value) {
    if (typeof operator !== 'string' || !ALLOWED_OPERATORS.has(operator)) {
      throw new Error(`QueryBuilder.where 操作符不在白名单: ${operator}`)
    }

    if (operator === 'IS' || operator === 'IS NOT') {
      // 仅允许 null / true / false，避免把任意字符串拼到 SQL
      if (value !== null && value !== true && value !== false) {
        throw new Error(`QueryBuilder.where ${operator} 的 value 必须为 null / true / false`)
      }
    } else if (operator === 'IN' || operator === 'NOT IN') {
      if (!Array.isArray(value)) {
        throw new Error(`QueryBuilder.where ${operator} 的 value 必须是数组`)
      }
    }

    this.whereConditions.push({ field, operator, value })
    return this
  }

  orderBy(field, direction = 'ASC') {
    const dir = typeof direction === 'string' ? direction.toUpperCase() : direction
    if (!ALLOWED_DIRECTIONS.has(dir)) {
      throw new Error(`QueryBuilder.orderBy 方向必须在 [ASC, DESC] 中，收到：${direction}`)
    }
    this.orderByConditions.push({ field, direction: dir })
    return this
  }

  limit(limit) {
    assertIntegerInRange(limit, 'limit', 0, MAX_LIMIT)
    this.limitValue = limit
    return this
  }

  offset(offset) {
    assertIntegerInRange(offset, 'offset', 0, Number.MAX_SAFE_INTEGER)
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
      const dbField = resolveDbField(model, condition.field)

      if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
        const placeholders = Array(condition.value.length).fill('?').join(', ')
        conditions.push(`${dbField} ${condition.operator} (${placeholders})`)
        params.push(...condition.value)
      } else if (condition.operator === 'IS' || condition.operator === 'IS NOT') {
        // IS / IS NOT 不使用占位符；value 已在 where() 入口限定为 null/true/false
        const literal = condition.value === null ? 'NULL' : (condition.value ? 'TRUE' : 'FALSE')
        conditions.push(`${dbField} ${condition.operator} ${literal}`)
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
      const dbField = resolveDbField(model, order.field)
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
  // env / waitUntil 用于慢查询日志：
  //   env 提供 DB binding 与阈值配置；waitUntil 把日志写入交给后台执行，不阻塞主请求。
  // 老代码只传 db，新代码应同时传 env 与 waitUntil；缺省时不影响业务功能。
  constructor(db, env = null, waitUntil = null) {
    this.db = db
    this.env = env
    this.waitUntil = typeof waitUntil === 'function' ? waitUntil : null
  }

  /**
   * 统一执行 D1 语句 + 慢查询计时。
   *
   * 用法：await this.executeQuery('SELECT', sql, params, stmt => stmt.all())
   *
   * @param {string} operation SQL 操作类型（SELECT/INSERT/UPDATE/DELETE/OTHER）
   * @param {string} sql 完整 SQL（会原样入库）
   * @param {Array} params bind 参数数组
   * @param {(stmt: any) => Promise<any>} execFn 实际执行语句的回调
   * @returns {Promise<any>} execFn 的返回值
   */
  async executeQuery(operation, sql, params, execFn) {
    const startedAt = Date.now()
    let result
    let err = null
    try {
      result = await execFn(this.db.prepare(sql).bind(...(params || [])))
      return result
    } catch (e) {
      err = e
      throw e
    } finally {
      const durationMs = Date.now() - startedAt
      this._maybeLogSlowQuery(operation, sql, params, durationMs, err)
    }
  }

  _maybeLogSlowQuery(operation, sql, params, durationMs, error) {
    if (!this.env || !this.env.DB) return
    const { enabled } = shouldLogSlowQuery(this.env, durationMs)
    if (!enabled) return

    const meta = parseSqlMeta(sql)
    const task = logSlowQuery(this.env, {
      sqlText: sql,
      params,
      durationMs,
      operation: operation || meta.operation,
      tableName: meta.tableName,
      source: 'model',
      error: error ? (error.message || String(error)) : null,
    })

    if (this.waitUntil) {
      try { this.waitUntil(task) } catch { /* waitUntil 不可用时静默 */ }
    } else {
      // 兜底：没有 waitUntil 时也不阻塞，挂到微任务即可
      task.catch(() => {})
    }
  }

  // 字段映射：数据库字段名 -> JS字段名
  mapFromDb(data) {
    const mapped = {}

    for (const [jsField, fieldConfig] of Object.entries(this.config.fields)) {
      const dbField = fieldConfig.dbField || jsField
      if (data[dbField] !== undefined) {
        let value = data[dbField]
        // D1 CURRENT_TIMESTAMP 返回 UTC 时间，格式如 "2024-03-20 06:00:00"
        // 转换为 ISO 格式并添加 UTC 标记，确保前端正确解析
        if (fieldConfig.type === 'datetime' && value && typeof value === 'string') {
          // 如果没有时区标记，转换为 ISO 格式（假设数据库存储的是 UTC 时间）
          if (!value.endsWith('Z') && !value.includes('+') && !value.includes('T')) {
            // 将 "2024-03-20 06:00:00" 格式转换为 "2024-03-20T06:00:00Z"
            value = value.replace(' ', 'T') + 'Z'
          }
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

    // 如果 model 声明了 createdAt 字段（dbField 通常为 'created_at' / 'create_time'），
    // 自动用 SQL CURRENT_TIMESTAMP 写入，避免业务代码在 create 后再发一条 UPDATE 补时间。
    // 注意：D1 的 CURRENT_TIMESTAMP 返回 UTC 时间，与前端解析约定一致（见 mapFromDb 的 datetime 分支）。
    const createdAtField = this.config.fields.createdAt?.dbField
      || this.config.fields.createTime?.dbField

    if (createdAtField && !Object.prototype.hasOwnProperty.call(mappedData, createdAtField)) {
      // 没传 createdAt 时不追加到 bind 参数，由 SQL 自带 CURRENT_TIMESTAMP 占位
      const fields = Object.keys(mappedData)
      const placeholders = fields.map(() => '?').join(', ')
      const values = Object.values(mappedData)
      const sql = `INSERT INTO ${this.config.tableName} (${[...fields, createdAtField].join(', ')}) VALUES (${placeholders}, CURRENT_TIMESTAMP)`
      await this.executeQuery('INSERT', sql, values, (stmt) => stmt.run())
      return { id: mappedData.id, success: true }
    }

    const fields = Object.keys(mappedData)
    const placeholders = fields.map(() => '?').join(', ')
    const values = Object.values(mappedData)

    const sql = `INSERT INTO ${this.config.tableName} (${fields.join(', ')}) VALUES (${placeholders})`

    await this.executeQuery('INSERT', sql, values, (stmt) => stmt.run())

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
    
    const result = await this.executeQuery('SELECT', sql, params, (stmt) => stmt.all())
    return result.results.map(row => this.mapFromDb(row))
  }

  // 查询单条记录
  async findOne(queryBuilder) {
    const whereClause = queryBuilder.buildWhere(this)

    let sql = `SELECT * FROM ${this.config.tableName}${whereClause.sql} LIMIT 1`

    const result = await this.executeQuery('SELECT', sql, whereClause.params, (stmt) => stmt.first())
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

    const result = await this.executeQuery('UPDATE', sql, values, (stmt) => stmt.run())
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

    const result = await this.executeQuery('UPDATE', sql, values, (stmt) => stmt.run())
    return (result.meta?.changes ?? result.changes ?? 0) > 0
  }

  // 删除记录
  async delete(id) {
    const sql = `DELETE FROM ${this.config.tableName} WHERE id = ?`

    const result = await this.executeQuery('DELETE', sql, [id], (stmt) => stmt.run())
    return (result.meta?.changes ?? result.changes ?? 0) > 0
  }

  // 使用查询构建器删除记录
  async deleteWithQuery(queryBuilder) {
    const whereClause = queryBuilder.buildWhere(this)
    const sql = `DELETE FROM ${this.config.tableName}${whereClause.sql}`

    const result = await this.executeQuery('DELETE', sql, whereClause.params, (stmt) => stmt.run())
    return (result.meta?.changes ?? result.changes ?? 0) > 0
  }

  // 检查记录是否存在
  async exists(id) {
    const sql = `SELECT 1 FROM ${this.config.tableName} WHERE id = ? LIMIT 1`

    const result = await this.executeQuery('SELECT', sql, [id], (stmt) => stmt.first())
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

    const result = await this.executeQuery('SELECT', sql, params, (stmt) => stmt.first())
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
        groupId: { type: 'string', dbField: 'group_id' }, // 笔记所属分组，NULL 表示未分组
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// NoteGroup 模型 - 笔记分组模型
export class NoteGroupModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'note_groups',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' }, // 用户ID
        name: { type: 'string' }, // 分组名称
        color: { type: 'string' }, // 分组颜色（hex #RRGGBB）
        sortOrder: { type: 'integer', dbField: 'sort_order' }, // 排序值，越小越靠前
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

  static error(message, origin, status = 500, detail = null) {
    // 业务 catch 抛真异常时，把 error.message + error.stack 通过 detail 传进来，
    // 中间件 (_middleware.js) 会读到 detail 字段并写入 api_error_logs.error_stack。
    // 前端 axios 默认会忽略 detail（按 error 字段弹 ElMessage 即可）。
    const body = { error: message }
    if (detail) body.detail = detail
    return new Response(JSON.stringify(body), {
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
      // pageSize 上限与 QueryBuilder.MAX_LIMIT 对齐：超出会被 limit() 抛错，
      //   导致整个列表查询 500。这里静默截断到上限，返回用户尽可能多的数据。
      const requested = parseInt(url.searchParams.get('pageSize')) || defaultPageSize
      this.pageSize = Math.max(1, Math.min(MAX_LIMIT, requested))
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
//
// 返回 { success, db, env, waitUntil }：
//   - db 是经过慢查询包装的对象，所有 db.prepare().bind().run/all/first 都会被计时
//   - env / waitUntil 透传出来，方便调用方转发给 Model 构造函数
export function initDatabase(env, waitUntil = null) {
  // 确保D1数据库存在
  if (!env || !env.DB) {
    console.error('D1 database not bound. Please check your Cloudflare Pages configuration.')
    return {
      success: false,
      response: ApiResponse.error('Database not available', '*', 500),
    }
  }

  const safeWaitUntil = typeof waitUntil === 'function' ? waitUntil : null

  return {
    success: true,
    db: wrapDb(env.DB, env, safeWaitUntil),
    env,
    waitUntil: safeWaitUntil,
  }
}

// ===== D1 慢查询包装层 =====
//
// 目标：让所有 `db.prepare(...).bind(...).run/all/first()` 的耗时都被统计。
// 实现：包装 prepare / batch / exec / dump。
//
// 兼容性：
//   - 直接用 env.DB.prepare(sql).bind(...).all() 的代码（占项目里大多数）零改动
//   - Model 基类仍然走 this.executeQuery（不依赖 wrapDb），与本包装互不冲突
//
// 限制：
//   - wrapDb 不知道当前请求 path/method/uid（这是设计取舍：Proxy 实现复杂且收益小）。
//     所以 source='raw' 的日志这几列为 NULL；context 上的 path/method 由调用方显式注入。

/**
 * 包一层 D1 prepared statement，让 run / all / first / raw 自带计时与慢查询落库。
 *
 * bind(...) 必须返回一个对象（不是真正的 D1PreparedStatement），但只要属性齐备、
 * 支持链式 bind + 终态 run/all/first/raw，业务代码就完全无感。
 *
 * 关键点：每次 .bind() 都返回一个新的 Proxy，但执行（run/all/first）时需要拿到
 * 最近一次 bind 的参数。用一个外层闭包持有 params，bind 时写入，exec 时读取。
 */
/**
 * 让 db.batch() 能从包装 Proxy 里取回「真正绑定好参数的 D1 语句」。
 * 用 Symbol.for 保证跨模块引用同一个 key。
 */
export const REAL_BOUND_STMT = Symbol.for('wrappedD1.realBoundStmt')

function wrapPreparedStatement(innerStmt, sql, env, waitUntil, initialParams = []) {
  // params 在闭包中共享：bind 写入，exec 读取
  let params = initialParams

  // D1 的 .first() / .all() / .run() / .raw() 都不接受绑定值——
  // 参数只能通过 .bind() 传入。所以这里必须先对真实语句调用 .bind(...)，
  // 再执行对应方法；不能把 params 直接展开传给 innerStmt[method](...)，
  // 否则 D1 会把第一个值误当成 .first(colName) 的列名，导致
  // "Wrong number of parameter bindings"。
  const boundStmt = () => (params.length > 0 ? innerStmt.bind(...params) : innerStmt)

  const makeExec = (method) => async () => {
    const startedAt = Date.now()
    let result
    let err = null
    try {
      result = await boundStmt()[method]()
      return result
    } catch (e) {
      err = e
      throw e
    } finally {
      const durationMs = Date.now() - startedAt
      maybeLogRaw(env, waitUntil, sql, params, durationMs, err)
    }
  }

  const handler = {
    get(_target, prop) {
      if (prop === 'bind') {
        return (...values) => {
          // 返回同一个 Proxy 实例，但更新闭包中的 params
          // 通过把 params 写到 Proxy 上一个属性上，并返回同一个 proxy：
          //   执行端（run/all/first）始终通过该 proxy 触发 get，能拿到最新 params。
          // 实现：用 mutable 容器（数组），让 bind 与 exec 共享。
          params = values
          // 把最新 params 暴露给 exec 闭包：直接通过外层 let 变量即可
          return wrappedProxy
        }
      }
      if (prop === 'run') return makeExec('run')
      if (prop === 'all') return makeExec('all')
      if (prop === 'first') return makeExec('first')
      if (prop === 'raw') return makeExec('raw')
      // db.batch() 需要真正的（已绑定参数的）D1 语句，而不是这个 Proxy
      if (prop === REAL_BOUND_STMT) return boundStmt()
      // 其他属性（如 Symbol.toPrimitive 等）尽量原样返回
      const v = innerStmt[prop]
      return typeof v === 'function' ? v.bind(innerStmt) : v
    },
  }

  const wrappedProxy = new Proxy({}, handler)
  return wrappedProxy
}

function maybeLogRaw(env, waitUntil, sql, params, durationMs, error) {
  if (!env || !env.DB) return
  const { enabled } = shouldLogSlowQuery(env, durationMs)
  if (!enabled) return

  const meta = parseSqlMeta(sql)
  const task = logSlowQuery(env, {
    sqlText: sql,
    params: Array.isArray(params) ? params : null,
    durationMs,
    operation: meta.operation,
    tableName: meta.tableName,
    source: 'raw',
    error: error ? (error.message || String(error)) : null,
  })

  if (typeof waitUntil === 'function') {
    try { waitUntil(task) } catch { /* waitUntil 失败时静默 */ }
  } else {
    task.catch(() => {})
  }
}

class WrappedD1Database {
  constructor(rawDb, env, waitUntil) {
    this._raw = rawDb
    this._env = env
    this._waitUntil = typeof waitUntil === 'function' ? waitUntil : null
  }

  prepare(sql) {
    return wrapPreparedStatement(this._raw.prepare(sql), sql, this._env, this._waitUntil)
  }

  // batch 转发：先把包装 Proxy 还原成真正绑定好参数的 D1 语句，
  // 否则 this._raw.batch() 拿到的是 Proxy，D1 序列化/执行会失败。
  // （travel-maps 的 saveMap / deleteMap 就依赖 batch。）
  batch(statements) {
    const unwrapped = (statements || []).map((s) => (s && s[REAL_BOUND_STMT]) || s)
    return this._raw.batch(unwrapped)
  }

  // exec / dump 是 D1 内部管理接口，按原样转发
  exec(sql) {
    return this._raw.exec(sql)
  }

  async dump() {
    if (typeof this._raw.dump === 'function') return this._raw.dump()
    throw new Error('D1 dump() is not supported in this runtime')
  }
}

// ===== 实际 raw SQL 包装函数 =====
//
// 暴露独立函数以便单元测试 / 其他模块复用。
export function wrapDb(rawDb, env, waitUntil = null) {
  if (!rawDb) return null
  return new WrappedD1Database(rawDb, env, waitUntil)
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
        category: { type: 'string' },
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

      await this.executeQuery('INSERT', sql, values, (stmt) => stmt.run())

      return { success: true, id }
    } catch (error) {
      console.error('QAModel create error:', error)
      return { success: false, error: error.message }
    }
  }

  // 重写update方法以处理JSON数据
  async update(id, data) {
    try {
      const now = new Date().toISOString()

      // 处理qaItems JSON序列化
      const qaItemsJson = data.qaItems ? JSON.stringify(data.qaItems) : '[]'

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
      const result = await this.executeQuery('UPDATE', sql, values, (stmt) => stmt.run())

      // 修复：检查正确的changes字段
      const changes = result.meta?.changes ?? result.changes ?? 0

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
      const result = await this.executeQuery('SELECT', sql, [id], (stmt) => stmt.first())

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
      
      const results = await this.executeQuery('SELECT', sql, params, (stmt) => stmt.all())

      return results.map(result => {
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
    
    const results = await this.executeQuery('SELECT', sql, params, (stmt) => stmt.all())

    // 确保results是数组
    const resultsArray = Array.isArray(results) ? results : (results.results || [])

    return resultsArray.map(result => {
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
    })
  }
}

// WeightMember 模型 - 体重记录成员模型
export class WeightMemberModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'weight_members',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        name: { type: 'string' },
        height: { type: 'real' },
        avatarColor: { type: 'string', dbField: 'avatar_color' },
        avatarEmoji: { type: 'string', dbField: 'avatar_emoji' },
        isDefault: { type: 'integer', dbField: 'is_default' },
        goalWeight: { type: 'real', dbField: 'goal_weight' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// Link 模型 - 短链接模型
export class LinkModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'short_links',
      fields: {
        id: { type: 'string', primaryKey: true },
        slug: { type: 'string' },
        url: { type: 'string' },
        title: { type: 'string' },
        uid: { type: 'string' },
        clicks: { type: 'integer' },
        expireAt: { type: 'datetime', dbField: 'expire_at' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }

  async findBySlug(slug) {
    return this.findOne(new QueryBuilder().where('slug', '=', slug))
  }

  async incrementClicks(slug) {
    const sql = `UPDATE ${this.config.tableName} SET clicks = clicks + 1, update_time = CURRENT_TIMESTAMP WHERE slug = ?`
    await this.executeQuery('UPDATE', sql, [slug], (stmt) => stmt.run())
  }
}

// Bookmark 模型 - 收藏夹/稍后读模型
export class BookmarkModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'bookmarks',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        url: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'text' },
        tags: { type: 'text' },
        isRead: { type: 'integer', dbField: 'is_read' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }

  // 重写 findAll 以反序列化 tags
  async findAll(queryBuilder) {
    const results = await super.findAll(queryBuilder)
    return results.map(item => this._deserialize(item))
  }

  // 重写 findOne 以反序列化 tags
  async findOne(queryBuilder) {
    const result = await super.findOne(queryBuilder)
    return result ? this._deserialize(result) : null
  }

  _deserialize(item) {
    if (item.tags && typeof item.tags === 'string') {
      try {
        item.tags = JSON.parse(item.tags)
      } catch {
        item.tags = []
      }
    }
    return item
  }
}

// WeightRecord 模型 - 体重记录模型
export class WeightRecordModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'weight_records',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        memberId: { type: 'string', dbField: 'member_id' },
        weight: { type: 'real' },
        height: { type: 'real' },
        note: { type: 'text' },
        recordDate: { type: 'string', dbField: 'record_date' },
        recordTime: { type: 'string', dbField: 'record_time' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// HeightMember 模型 - 身高记录成员模型
export class HeightMemberModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'height_members',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        name: { type: 'string' },
        birthDate: { type: 'string', dbField: 'birth_date' },
        sex: { type: 'string' },
        goalHeight: { type: 'real', dbField: 'goal_height' },
        avatarColor: { type: 'string', dbField: 'avatar_color' },
        avatarEmoji: { type: 'string', dbField: 'avatar_emoji' },
        isDefault: { type: 'integer', dbField: 'is_default' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// HeightRecord 模型 - 身高记录模型
export class HeightRecordModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'height_records',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        memberId: { type: 'string', dbField: 'member_id' },
        height: { type: 'real' },
        note: { type: 'text' },
        recordDate: { type: 'string', dbField: 'record_date' },
        recordTime: { type: 'string', dbField: 'record_time' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// SalaryMember 模型 - 工资记录成员模型
export class SalaryMemberModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'salary_members',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        name: { type: 'string' },
        avatarColor: { type: 'string', dbField: 'avatar_color' },
        avatarEmoji: { type: 'string', dbField: 'avatar_emoji' },
        isDefault: { type: 'integer', dbField: 'is_default' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// SalaryRecord 模型 - 工资记录模型
export class SalaryRecordModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'salary_records',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        memberId: { type: 'string', dbField: 'member_id' },
        monthlyIncome: { type: 'real', dbField: 'monthly_income' },
        effectiveDate: { type: 'string', dbField: 'effective_date' },
        source: { type: 'string' },
        note: { type: 'text' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// FixedExpense 模型 - 每月固定开销模型（单用户）
export class FixedExpenseModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'fixed_expenses',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        name: { type: 'string' },
        amount: { type: 'real' },
        category: { type: 'string' },
        billingDay: { type: 'integer', dbField: 'billing_day' },
        startDate: { type: 'string', dbField: 'start_date' },
        endDate: { type: 'string', dbField: 'end_date' },
        note: { type: 'text' },
        isActive: { type: 'integer', dbField: 'is_active' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// MockSchema 模型 - Mock 数据生成器配方
export class MockSchemaModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'mock_schemas',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'text' },
        schema: { type: 'text' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }

  // schema 字段在 DB 里是 JSON 字符串，读出时反序列化为数组
  _deserialize(item) {
    if (item && typeof item.schema === 'string') {
      try {
        item.schema = JSON.parse(item.schema)
      } catch {
        item.schema = []
      }
    }
    return item
  }

  async findAll(queryBuilder) {
    const results = await super.findAll(queryBuilder)
    return results.map(item => this._deserialize(item))
  }

  async findOne(queryBuilder) {
    const result = await super.findOne(queryBuilder)
    return result ? this._deserialize(result) : null
  }

  async findById(id) {
    return this.findOne(new QueryBuilder().where('id', '=', id))
  }
}

// OssCredential 模型 - 阿里云 OSS 配置
// AccessKey ID 与 Secret 在数据库中使用 AES-GCM 加密存储
export class OssCredentialModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'oss_credentials',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        name: { type: 'string' },
        region: { type: 'string' },
        bucket: { type: 'string' },
        endpoint: { type: 'string' },
        accessKeyIdEnc: { type: 'text', dbField: 'access_key_id_enc' },
        accessKeySecretEnc: { type: 'text', dbField: 'access_key_secret_enc' },
        roleArn: { type: 'text', dbField: 'role_arn' },
        policy: { type: 'text' },
        durationSeconds: { type: 'integer', dbField: 'duration_seconds' },
        isDefault: { type: 'integer', dbField: 'is_default' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// PriceComparisonItem 模型 - 比价物品主表
export class PriceComparisonItemModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'price_comparison_items',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        name: { type: 'string' },
        category: { type: 'string' },
        spec: { type: 'string' },
        note: { type: 'text' },
        status: { type: 'integer' },
        chosenEntryId: { type: 'string', dbField: 'chosen_entry_id' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// PriceComparisonEntry 模型 - 比价条目（同一商品在不同平台的价格）
export class PriceComparisonEntryModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'price_comparison_entries',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        itemId: { type: 'string', dbField: 'item_id' },
        platform: { type: 'string' },
        unitPrice: { type: 'real', dbField: 'unit_price' },
        shippingFee: { type: 'real', dbField: 'shipping_fee' },
        discount: { type: 'real' },
        finalPrice: { type: 'real', dbField: 'final_price' },
        quantity: { type: 'integer' },
        currency: { type: 'string' },
        status: { type: 'integer' },
        purchaseDate: { type: 'string', dbField: 'purchase_date' },
        link: { type: 'text' },
        seller: { type: 'string' },
        note: { type: 'text' },
        isChosen: { type: 'integer', dbField: 'is_chosen' },
        createTime: { type: 'datetime', dbField: 'create_time' },
        updateTime: { type: 'datetime', dbField: 'update_time' }
      }
    }
  }
}

// 食物记录模型（单用户，无成员维度）
export class FoodLogModel extends Model {
  constructor(db) {
    super(db)
    this.config = {
      tableName: 'food_log',
      fields: {
        id: { type: 'string', primaryKey: true },
        uid: { type: 'string' },
        name: { type: 'string' },
        meal: { type: 'string' },
        category: { type: 'string' },
        quantity: { type: 'string' },
        calories: { type: 'integer' },
        note: { type: 'text' },
        eatenAt: { type: 'integer', dbField: 'eaten_at' },
        createdAt: { type: 'datetime', dbField: 'created_at' }
      }
    }
  }
}