import { ResumeModel, QueryBuilder } from '../utils/db.js'

export class ResumeService {
  constructor(db) {
    this.resumeModel = new ResumeModel(db)
  }

  // 获取当前用户的所有简历（支持分页）
  async getAllResumes(uid, pager) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('updateTime', 'DESC')
      
      // 应用分页
      pager.applyTo(queryBuilder)
      
      // 获取总数和数据
      const countQuery = new QueryBuilder().where('uid', '=', uid)
      const total = await this.resumeModel.count(countQuery)
      const resumes = await this.resumeModel.findAll(queryBuilder)
      
      return { 
        success: true, 
        data: pager.createResult(resumes, total)
      }
    } catch (error) {
      console.error('获取用户简历失败:', error)
      return { success: false, error: '获取简历列表失败' }
    }
  }

  // 根据ID获取当前用户的简历
  async getResumeById(id, uid) {
    try {
      const resume = await this.resumeModel.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )
      return { success: true, data: resume }
    } catch (error) {
      console.error('根据ID获取用户简历失败:', error)
      return { success: false, error: '获取简历详情失败' }
    }
  }

  // 为当前用户创建简历
  async createResume(resumeData, uid) {
    try {
      const result = await this.resumeModel.create({
        name: resumeData.name.trim(),
        template: resumeData.template || 'modern',
        personalInfo: JSON.stringify(resumeData.personalInfo || {}),
        workExperience: JSON.stringify(resumeData.workExperience || []),
        education: JSON.stringify(resumeData.education || []),
        skills: JSON.stringify(resumeData.skills || []),
        projects: JSON.stringify(resumeData.projects || []),
        certificates: JSON.stringify(resumeData.certificates || []),
        others: JSON.stringify(resumeData.others || {}),
        uid: uid
      })
      return { 
        success: true, 
        data: { 
          id: result.id, 
          message: '简历创建成功' 
        } 
      }
    } catch (error) {
      console.error('创建用户简历失败:', error)
      return { success: false, error: '创建简历失败' }
    }
  }

  // 更新当前用户的简历
  async updateResume(id, resumeData, uid) {
    try {
      const updateData = {}
      if (resumeData.name !== undefined) {
        updateData.name = resumeData.name.trim()
      }
      if (resumeData.template !== undefined) {
        updateData.template = resumeData.template
      }
      if (resumeData.personalInfo !== undefined) {
        updateData.personalInfo = JSON.stringify(resumeData.personalInfo)
      }
      if (resumeData.workExperience !== undefined) {
        updateData.workExperience = JSON.stringify(resumeData.workExperience)
      }
      if (resumeData.education !== undefined) {
        updateData.education = JSON.stringify(resumeData.education)
      }
      if (resumeData.skills !== undefined) {
        updateData.skills = JSON.stringify(resumeData.skills)
      }
      if (resumeData.projects !== undefined) {
        updateData.projects = JSON.stringify(resumeData.projects)
      }
      if (resumeData.certificates !== undefined) {
        updateData.certificates = JSON.stringify(resumeData.certificates)
      }
      if (resumeData.others !== undefined) {
        updateData.others = JSON.stringify(resumeData.others)
      }

      // 只更新属于当前用户的简历
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const updateSuccess = await this.resumeModel.updateWithQuery(updateData, queryBuilder)
      return { 
        success: true, 
        data: { 
          updated: updateSuccess,
          message: updateSuccess ? '简历更新成功' : '简历不存在或无权限，未执行更新' 
        } 
      }
    } catch (error) {
      console.error('更新用户简历失败:', error)
      return { success: false, error: '更新简历失败' }
    }
  }

  // 删除当前用户的简历
  async deleteResume(id, uid) {
    try {
      // 只删除属于当前用户的简历
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const deleteSuccess = await this.resumeModel.deleteWithQuery(queryBuilder)
      return { 
        success: true, 
        data: { 
          deleted: deleteSuccess,
          message: deleteSuccess ? '简历删除成功' : '简历不存在或无权限，无需删除' 
        } 
      }
    } catch (error) {
      console.error('删除用户简历失败:', error)
      return { success: false, error: '删除简历失败' }
    }
  }
}