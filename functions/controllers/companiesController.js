import { CompanyModel } from '../utils/db.js'
import { ApiResponse, QueryBuilder, Pager } from '../utils/db.js'

export class CompaniesController {
  constructor(db) {
    this.model = new CompanyModel(db)
  }

  // 获取当前用户的所有公司记录（支持分页）
  async index(user, pager, origin) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', user.id)
        .orderBy('updateTime', 'DESC')

      pager.applyTo(queryBuilder)
      const total = await this.model.count(new QueryBuilder().where('uid', '=', user.id))
      const companies = await this.model.findAll(queryBuilder)

      const result = pager.createResult(companies, total)
      return ApiResponse.success(result, origin)
    } catch (error) {
      console.error('获取公司列表失败:', error)
      return ApiResponse.error('获取公司列表失败', origin, 500)
    }
  }

  // 根据ID获取当前用户的公司记录
  async show(id, user, origin) {
    try {
      const company = await this.model.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', user.id)
      )

      if (!company) {
        return ApiResponse.error('公司记录不存在', origin, 404)
      }

      return ApiResponse.success({ data: company }, origin)
    } catch (error) {
      console.error('获取公司记录失败:', error)
      return ApiResponse.error('获取公司记录失败', origin, 500)
    }
  }

  // 为当前用户创建公司记录
  async store(data, user, origin) {
    try {
      // 验证必填字段
      if (!data.name || !data.position) {
        return ApiResponse.error('公司名称和职位为必填项', origin, 400)
      }

      // 准备数据
      const companyData = {
        uid: user.id,
        name: data.name,
        position: data.position,
        salary: data.salary || '',
        benefits: data.benefits || '',
        workDays: data.workDays || '',
        workHours: data.workHours || '',
        location: data.location || '',
        welfare: data.welfare || '',
        overtime: data.overtime || '',
        leavePolicy: data.leavePolicy || '',
        notes: data.notes || ''
      }

      const result = await this.model.create(companyData)

      if (result.success) {
        return ApiResponse.success({ 
          message: '创建成功',
          id: result.id 
        }, origin, 201)
      } else {
        return ApiResponse.error('创建失败', origin, 500)
      }
    } catch (error) {
      console.error('创建公司记录失败:', error)
      return ApiResponse.error('创建失败', origin, 500)
    }
  }

  // 更新当前用户的公司记录
  async update(id, data, user, origin) {
    try {
      // 验证必填字段
      if (!data.name || !data.position) {
        return ApiResponse.error('公司名称和职位为必填项', origin, 400)
      }

      // 检查记录是否存在且属于当前用户
      const existingCompany = await this.model.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', user.id)
      )

      if (!existingCompany) {
        return ApiResponse.error('公司记录不存在', origin, 404)
      }

      // 准备更新数据
      const updateData = {
        name: data.name,
        position: data.position,
        salary: data.salary || '',
        benefits: data.benefits || '',
        workDays: data.workDays || '',
        workHours: data.workHours || '',
        location: data.location || '',
        welfare: data.welfare || '',
        overtime: data.overtime || '',
        leavePolicy: data.leavePolicy || '',
        notes: data.notes || ''
      }

      const success = await this.model.update(id, updateData)

      if (success) {
        return ApiResponse.success({ message: '更新成功' }, origin)
      } else {
        return ApiResponse.error('更新失败', origin, 500)
      }
    } catch (error) {
      console.error('更新公司记录失败:', error)
      return ApiResponse.error('更新失败', origin, 500)
    }
  }

  // 删除当前用户的公司记录
  async destroy(id, user, origin) {
    try {
      // 检查记录是否存在且属于当前用户
      const existingCompany = await this.model.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', user.id)
      )

      if (!existingCompany) {
        return ApiResponse.error('公司记录不存在', origin, 404)
      }

      const success = await this.model.delete(id)

      if (success) {
        return ApiResponse.success({ message: '删除成功' }, origin)
      } else {
        return ApiResponse.error('删除失败', origin, 500)
      }
    } catch (error) {
      console.error('删除公司记录失败:', error)
      return ApiResponse.error('删除失败', origin, 500)
    }
  }
}
