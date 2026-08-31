import { ApiResponse, QAModel, QueryBuilder, Pager } from '../utils/db.js'
import { AuthMiddleware } from '../middlewares/auth.js'

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
          return await this.getQAById(id, origin, env)
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
    const body = await request.json()
    
    // 验证必填字段
    if (!body.title || !body.qaItems || !Array.isArray(body.qaItems) || body.qaItems.length === 0) {
      return ApiResponse.error('标题和问答对不能为空', origin, 400)
    }

    // 验证问答对格式
    for (const qaItem of body.qaItems) {
      if (!qaItem.question || !qaItem.answer) {
        return ApiResponse.error('每个问答对的问题和答案都不能为空', origin, 400)
      }
    }

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

  // 根据ID获取QA（需要认证）
  async getQAById(id, origin, env) {
    const qa = await this.qaModel.findById(id)
    
    if (!qa) {
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
    const body = await request.json()

    // 验证必填字段
    if (!body.title || !body.qaItems || !Array.isArray(body.qaItems) || body.qaItems.length === 0) {
      return ApiResponse.error('标题和问答对不能为空', origin, 400)
    }

    // 验证问答对格式
    for (const qaItem of body.qaItems) {
      if (!qaItem.question || !qaItem.answer) {
        return ApiResponse.error('每个问答对的问题和答案都不能为空', origin, 400)
      }
    }

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