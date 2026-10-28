import { ApiResponse, QAModel, QueryBuilder, Pager } from '../utils/db.js'
import { AuthMiddleware } from '../middlewares/auth.js'

const MAX_TITLE_LENGTH = 200
const MAX_QA_ITEMS = 50
const MAX_QUESTION_LENGTH = 5000
const MAX_ANSWER_LENGTH = 20000
const MAX_CUSTOM_CONTENT_LENGTH = 10000
const MAX_TOTAL_CONTENT_LENGTH = 500000
const MAX_REQUEST_BYTES = 600000

async function readQARequestBody(request) {
  const declaredLength = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return null
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

export function validateQAInput(body) {
  if (!body || typeof body !== 'object' || typeof body.title !== 'string' || !body.title.trim()) {
    return '标题和问答对不能为空'
  }
  if (body.title.length > MAX_TITLE_LENGTH) return `标题不能超过 ${MAX_TITLE_LENGTH} 个字符`
  if (!Array.isArray(body.qaItems) || body.qaItems.length === 0 || body.qaItems.length > MAX_QA_ITEMS) {
    return `问答对数量需为 1-${MAX_QA_ITEMS}`
  }
  let total = body.title.length
  for (const item of body.qaItems) {
    if (!item || typeof item.question !== 'string' || typeof item.answer !== 'string' ||
        !item.question.trim() || !item.answer.trim()) return '每个问答对的问题和答案都不能为空'
    if (item.question.length > MAX_QUESTION_LENGTH || item.answer.length > MAX_ANSWER_LENGTH) {
      return '问题或答案超过长度上限'
    }
    total += item.question.length + item.answer.length
  }
  for (const key of ['headerContent', 'footerContent']) {
    const value = body[key] ?? ''
    if (typeof value !== 'string' || value.length > MAX_CUSTOM_CONTENT_LENGTH) {
      return `头部/尾部内容不能超过 ${MAX_CUSTOM_CONTENT_LENGTH} 个字符`
    }
    total += value.length
  }
  return total > MAX_TOTAL_CONTENT_LENGTH ? 'QA页面总内容超过长度上限' : ''
}

export class QARouter {
  constructor(db, env = null, waitUntil = null) {
    this.db = db
    this.qaModel = new QAModel(db, env, waitUntil)
  }

  async handle(request, path, env, origin) {
    const method = request.method

    try {
      // 处理不同的路由
      if (path === '' || path === '/') {
        if (method === 'GET') {
          return await this.getQAList(request, origin, env)
        } else if (method === 'POST') {
          return await this.createQA(request, origin, env)
        }
      } else {
        // 处理带ID的路径，去掉开头的/（如果有的话）
        const id = path.startsWith('/') ? path.substring(1) : path

        if (method === 'GET') {
          return await this.getQAById(id, request, origin, env)
        } else if (method === 'PUT') {
          return await this.updateQA(id, request, origin, env)
        } else if (method === 'DELETE') {
          return await this.deleteQA(id, request, origin, env)
        }
      }

      return ApiResponse.error('Not Found', origin, 404)
    } catch (error) {
      console.error('QA Router error:', error)
      return ApiResponse.error('内部服务器错误', origin, 500)
    }
  }

  // 获取QA列表（需要认证）
  async getQAList(request, origin, env) {
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    const user = authResult.user
    const pager = Pager.fromRequest(request, 12)
    
    const queryBuilder = new QueryBuilder()
      .where('uid', '=', user.id)
      .orderBy('updateTime', 'DESC')
    
    const result = await this.qaModel.paginate(pager.page, pager.pageSize, queryBuilder)
    
    return ApiResponse.success({
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1
      }
    }, origin)
  }

  // 创建QA（需要认证）
  async createQA(request, origin, env) {
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    const user = authResult.user
    const body = await readQARequestBody(request)
    const validationError = validateQAInput(body)
    if (validationError) return ApiResponse.error(validationError, origin, 400)
    
    const qaData = {
      uid: user.id,
      title: body.title.trim(),
      qaItems: body.qaItems.map(item => ({
        question: item.question.trim(),
        answer: item.answer.trim()
      })),
      headerContent: body.headerContent || '',
      footerContent: body.footerContent || '',
      isPublic: Boolean(body.isPublic)
    }

    const result = await this.qaModel.create(qaData)
    
    if (result.success) {
      return ApiResponse.success({
        id: result.id,
        message: 'QA页面创建成功'
      }, origin, 201)
    } else {
      return ApiResponse.error('创建失败', origin, 500)
    }
  }

  // 根据ID获取QA（公开页面允许匿名访问（分享场景），私有页面仅属主可访问）
  async getQAById(id, request, origin, env) {
    const qa = await this.qaModel.findById(id)

    if (!qa) {
      return ApiResponse.error('QA页面不存在', origin, 404)
    }

    // 公开页面任何人可读；非属主响应中不返回uid，避免暴露属主身份
    if (qa.isPublic) {
      const publicAuth = await AuthMiddleware.extractUserFromRequestOptional(request, env)
      if (publicAuth.user && publicAuth.user.id === qa.uid) {
        return ApiResponse.success(qa, origin)
      }
      const { uid, ...publicData } = qa
      return ApiResponse.success(publicData, origin)
    }

    // 私有页面需要登录；已登录但非属主统一返回404（与不存在同响应），避免枚举UUID
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    if (qa.uid !== authResult.user.id) {
      return ApiResponse.error('QA页面不存在', origin, 404)
    }

    return ApiResponse.success(qa, origin)
  }

  // 更新QA（需要认证）
  async updateQA(id, request, origin, env) {
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    const user = authResult.user
    const body = await readQARequestBody(request)
    const validationError = validateQAInput(body)
    if (validationError) return ApiResponse.error(validationError, origin, 400)

    // 检查QA是否存在且属于当前用户
    const existingQA = await this.qaModel.findById(id)

    if (!existingQA) {
      return ApiResponse.error('QA页面不存在', origin, 404)
    }

    if (existingQA.uid !== user.id) {
      return ApiResponse.error('无权限访问', origin, 403)
    }

    const updateData = {
      title: body.title.trim(),
      qaItems: body.qaItems.map(item => ({
        question: item.question.trim(),
        answer: item.answer.trim()
      })),
      headerContent: body.headerContent || '',
      footerContent: body.footerContent || '',
      isPublic: Boolean(body.isPublic)
    }

    const success = await this.qaModel.update(id, updateData)

    if (success) {
      return ApiResponse.success({
        message: 'QA页面更新成功'
      }, origin)
    } else {
      return ApiResponse.error('更新失败', origin, 500)
    }
  }

  // 删除QA（需要认证）
  async deleteQA(id, request, origin, env) {
    const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
    if (!authResult.success) {
      return AuthMiddleware.createAuthErrorResponse(authResult.error, origin)
    }

    const user = authResult.user

    // 检查QA是否存在且属于当前用户
    const existingQA = await this.qaModel.findById(id)
    if (!existingQA) {
      return ApiResponse.error('QA页面不存在', origin, 404)
    }

    if (existingQA.uid !== user.id) {
      return ApiResponse.error('无权限访问', origin, 403)
    }

    const success = await this.qaModel.delete(id)
    
    if (success) {
      return ApiResponse.success({
        message: 'QA页面删除成功'
      }, origin)
    } else {
      return ApiResponse.error('删除失败', origin, 500)
    }
  }
}