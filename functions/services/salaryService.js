import { SalaryRecordModel, SalaryMemberModel, QueryBuilder } from '../utils/db.js'

const DEFAULT_STATISTICS = {
  currentSalary: null,           // 当前月薪
  lastSalary: null,              // 上一条月薪
  changeAmount: 0,               // 较上次变动金额
  changePercent: 0,              // 较上次涨幅（%）
  totalRecords: 0,               // 总记录数
  totalRaises: 0,                // 涨薪次数（>上次）
  totalCuts: 0,                  // 降薪次数
  avgSalary: null,               // 平均月薪
  maxSalary: null,               // 历史最高
  minSalary: null,               // 历史最低
  yearsCovered: 0,               // 覆盖多少年
  firstRecordDate: null,         // 首条记录日期
  currentTenureMonths: 0,        // 距上次变动已多少月
  annualizedGrowth: 0,           // 年化增长率（%）
  yearlyReport: null             // 本年内变化报告
}

// 12 色板，和 HeightTracker 对齐
const MEMBER_COLORS = [
  '#409EFF', '#67C23A', '#E6A23C', '#F56C6C',
  '#909399', '#C71585', '#FF69B4', '#8A2BE2',
  '#00CED1', '#32CD32', '#FFD700', '#FF4500'
]
const MEMBER_EMOJIS = ['👤', '👨', '👩', '🧑', '👨‍💼', '👩‍💼', '🧔', '👱‍♀️', '👱', '🧑‍💻']

export class SalaryService {
  constructor(db) {
    this.db = db
    this.recordModel = new SalaryRecordModel(db)
    this.memberModel = new SalaryMemberModel(db)
  }

  // ===== 成员管理 =====

  async getAllMembers(uid) {
    try {
      const members = await this.memberModel.findAll(
        new QueryBuilder().where('uid', '=', uid).orderBy('isDefault', 'DESC').orderBy('createTime', 'ASC')
      )

      // 兼容旧数据：如果用户没有任何成员但有 NULL member_id 的记录，自动生成"默认成员"
      const legacyRecords = await this.recordModel.findAll(
        new QueryBuilder().where('uid', '=', uid).where('memberId', 'IS', null).limit(1)
      )
      if (legacyRecords.length > 0 && members.length === 0) {
        const defaultMember = await this.createMember({ name: '我', isDefault: true, avatarEmoji: '👤' }, uid)
        if (defaultMember.success) {
          // 把 NULL 记录回填到默认成员
          await this.db.prepare('UPDATE salary_records SET member_id = ? WHERE uid = ? AND member_id IS NULL')
            .bind(defaultMember.data.id, uid).run()
          // 重新查
          return this.getAllMembers(uid)
        }
      }

      return { success: true, data: members }
    } catch (error) {
      console.error('getAllMembers error:', error)
      return { success: false, error: '获取成员列表失败' }
    }
  }

  async getMemberById(id, uid) {
    try {
      const member = await this.memberModel.findOne(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: member }
    } catch (error) {
      return { success: false, error: '获取成员详情失败' }
    }
  }

  async createMember(data, uid) {
    try {
      const name = data.name.trim()

      // 同名检查（去重）
      const existing = await this.memberModel.findOne(
        new QueryBuilder().where('uid', '=', uid).where('name', '=', name)
      )
      if (existing) {
        return { success: true, data: { id: existing.id, updated: true, message: '成员已存在' } }
      }

      // 若设为默认，先取消其它默认
      if (data.isDefault) {
        await this.db.prepare('UPDATE salary_members SET is_default = 0 WHERE uid = ?').bind(uid).run()
      }

      const colorIndex = (await this.memberModel.findAll(new QueryBuilder().where('uid', '=', uid))).length % MEMBER_COLORS.length
      const result = await this.memberModel.create({
        uid,
        name,
        avatarColor: data.avatarColor || MEMBER_COLORS[colorIndex],
        avatarEmoji: data.avatarEmoji || MEMBER_EMOJIS[colorIndex],
        isDefault: data.isDefault ? 1 : 0
      })

      return { success: true, data: { id: result.id, updated: false, message: '成员创建成功' } }
    } catch (error) {
      console.error('createMember error:', error)
      return { success: false, error: '创建成员失败' }
    }
  }

  async updateMember(id, data, uid) {
    try {
      const updateData = {}
      if (data.name !== undefined) updateData.name = data.name.trim()
      if (data.avatarColor !== undefined) updateData.avatarColor = data.avatarColor
      if (data.avatarEmoji !== undefined) updateData.avatarEmoji = data.avatarEmoji
      if (data.isDefault !== undefined) {
        if (data.isDefault) {
          await this.db.prepare('UPDATE salary_members SET is_default = 0 WHERE uid = ? AND id != ?').bind(uid, id).run()
        }
        updateData.isDefault = data.isDefault ? 1 : 0
      }

      const ok = await this.memberModel.updateWithQuery(
        updateData,
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: { updated: ok, message: ok ? '成员更新成功' : '成员不存在或无权限' } }
    } catch (error) {
      return { success: false, error: '更新成员失败' }
    }
  }

  async deleteMember(id, uid) {
    try {
      // 级联删除该成员的工资记录
      const records = await this.recordModel.findAll(
        new QueryBuilder().where('uid', '=', uid).where('memberId', '=', id)
      )
      for (const r of records) {
        await this.recordModel.deleteWithQuery(
          new QueryBuilder().where('id', '=', r.id).where('uid', '=', uid)
        )
      }

      const ok = await this.memberModel.deleteWithQuery(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: { deleted: ok, deletedRecords: records.length, message: ok ? '成员删除成功' : '成员不存在或无权限' } }
    } catch (error) {
      return { success: false, error: '删除成员失败' }
    }
  }

  // ===== 工资记录操作 =====

  async getAllRecords(uid, options = {}) {
    try {
      const { memberId, startDate, endDate, limit } = options
      const qb = new QueryBuilder().where('uid', '=', uid)
      if (memberId) qb.where('memberId', '=', memberId)
      if (startDate) qb.where('effectiveDate', '>=', startDate)
      if (endDate) qb.where('effectiveDate', '<=', endDate)
      qb.orderBy('effectiveDate', 'DESC')
      if (limit) qb.limit(limit)
      const records = await this.recordModel.findAll(qb)
      return { success: true, data: records }
    } catch (error) {
      return { success: false, error: '获取工资记录失败' }
    }
  }

  async getRecordById(id, uid) {
    try {
      const record = await this.recordModel.findOne(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: record }
    } catch (error) {
      return { success: false, error: '获取记录详情失败' }
    }
  }

  async createRecord(data, uid) {
    try {
      const now = new Date()
      const effectiveDate = data.effectiveDate || now.toISOString().split('T')[0]
      const result = await this.recordModel.create({
        uid,
        memberId: data.memberId || null,
        monthlyIncome: data.monthlyIncome,
        effectiveDate,
        source: data.source || null,
        note: data.note || ''
      })
      return { success: true, data: { id: result.id, message: '工资记录创建成功' } }
    } catch (error) {
      return { success: false, error: '创建工资记录失败' }
    }
  }

  async updateRecord(id, data, uid) {
    try {
      const updateData = {}
      if (data.monthlyIncome !== undefined) updateData.monthlyIncome = data.monthlyIncome
      if (data.effectiveDate !== undefined) updateData.effectiveDate = data.effectiveDate
      if (data.source !== undefined) updateData.source = data.source || null
      if (data.note !== undefined) updateData.note = data.note
      if (data.memberId !== undefined) updateData.memberId = data.memberId || null
      const qb = new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      const ok = await this.recordModel.updateWithQuery(updateData, qb)
      return { success: true, data: { updated: ok, message: ok ? '更新成功' : '记录不存在或无权限' } }
    } catch (error) {
      return { success: false, error: '更新工资记录失败' }
    }
  }

  async deleteRecord(id, uid) {
    try {
      const qb = new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      const ok = await this.recordModel.deleteWithQuery(qb)
      return { success: true, data: { deleted: ok, message: ok ? '删除成功' : '记录不存在或无权限' } }
    } catch (error) {
      return { success: false, error: '删除工资记录失败' }
    }
  }

  // ===== 工具方法 =====

  monthsBetween(startDate, endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const months = (end.getFullYear() - start.getFullYear()) * 12 +
                   (end.getMonth() - start.getMonth())
    return Math.max(0, months)
  }

  calculateAnnualizedGrowth(records) {
    if (records.length < 2) return 0
    const sorted = [...records].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const months = this.monthsBetween(first.effectiveDate, last.effectiveDate)
    if (months === 0) return 0
    const ratio = last.monthlyIncome / first.monthlyIncome
    if (ratio <= 0) return 0
    const monthlyRate = Math.pow(ratio, 1 / months) - 1
    const annualRate = Math.pow(1 + monthlyRate, 12) - 1
    return parseFloat((annualRate * 100).toFixed(2))
  }

  generateYearlyReport(records) {
    if (records.length === 0) return null
    const now = new Date()
    const yearStart = `${now.getFullYear()}-01-01`
    const inYear = records.filter(r => r.effectiveDate >= yearStart)
    if (inYear.length === 0) return null

    const sorted = [...inYear].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
    const incomes = sorted.map(r => r.monthlyIncome)
    const startIncome = incomes[0]
    const endIncome = incomes[incomes.length - 1]
    const changeAmount = parseFloat((endIncome - startIncome).toFixed(2))
    const changePercent = startIncome > 0 ? parseFloat(((changeAmount / startIncome) * 100).toFixed(2)) : 0

    return {
      year: now.getFullYear(),
      recordCount: sorted.length,
      startIncome,
      endIncome,
      changeAmount,
      changePercent,
      maxIncome: Math.max(...incomes),
      minIncome: Math.min(...incomes),
      firstChangeDate: sorted[0].effectiveDate,
      lastChangeDate: sorted[sorted.length - 1].effectiveDate
    }
  }

  // ===== 统计 / 图表 / 导出 =====

  async getStatistics(uid, memberId) {
    try {
      const qb = new QueryBuilder().where('uid', '=', uid)
      if (memberId) qb.where('memberId', '=', memberId)
      const records = await this.recordModel.findAll(qb)

      if (records.length === 0) {
        return { success: true, data: { ...DEFAULT_STATISTICS } }
      }

      const sortedAsc = [...records].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
      const currentSalary = sortedAsc[sortedAsc.length - 1].monthlyIncome
      const lastSalary = sortedAsc.length > 1 ? sortedAsc[sortedAsc.length - 2].monthlyIncome : currentSalary

      const changeAmount = parseFloat((currentSalary - lastSalary).toFixed(2))
      const changePercent = lastSalary > 0 ? parseFloat(((changeAmount / lastSalary) * 100).toFixed(2)) : 0

      const incomes = sortedAsc.map(r => r.monthlyIncome)
      const avgSalary = parseFloat((incomes.reduce((s, x) => s + x, 0) / incomes.length).toFixed(2))
      const maxSalary = Math.max(...incomes)
      const minSalary = Math.min(...incomes)

      let totalRaises = 0, totalCuts = 0
      for (let i = 1; i < sortedAsc.length; i++) {
        if (sortedAsc[i].monthlyIncome > sortedAsc[i - 1].monthlyIncome) totalRaises++
        else if (sortedAsc[i].monthlyIncome < sortedAsc[i - 1].monthlyIncome) totalCuts++
      }

      const firstDate = sortedAsc[0].effectiveDate
      const lastDate = sortedAsc[sortedAsc.length - 1].effectiveDate
      const yearsCovered = parseFloat((this.monthsBetween(firstDate, lastDate) / 12).toFixed(2))
      const currentTenureMonths = this.monthsBetween(lastDate, new Date().toISOString().split('T')[0])
      const annualizedGrowth = this.calculateAnnualizedGrowth(sortedAsc)
      const yearlyReport = this.generateYearlyReport(sortedAsc)

      return {
        success: true,
        data: {
          currentSalary,
          lastSalary,
          changeAmount,
          changePercent,
          totalRecords: records.length,
          totalRaises,
          totalCuts,
          avgSalary,
          maxSalary,
          minSalary,
          yearsCovered,
          firstRecordDate: firstDate,
          currentTenureMonths,
          annualizedGrowth,
          yearlyReport
        }
      }
    } catch (error) {
      return { success: false, error: '获取统计数据失败' }
    }
  }

  async getChartData(uid, memberId) {
    try {
      const qb = new QueryBuilder().where('uid', '=', uid)
      if (memberId) qb.where('memberId', '=', memberId)
      qb.orderBy('effectiveDate', 'ASC')
      const records = await this.recordModel.findAll(qb)
      return {
        success: true,
        data: records.map(r => ({
          date: r.effectiveDate,
          income: r.monthlyIncome,
          id: r.id,
          memberId: r.memberId
        }))
      }
    } catch (error) {
      return { success: false, error: '获取图表数据失败' }
    }
  }

  async exportData(uid) {
    try {
      const members = await this.memberModel.findAll(
        new QueryBuilder().where('uid', '=', uid).orderBy('isDefault', 'DESC')
      )
      const records = await this.recordModel.findAll(
        new QueryBuilder().where('uid', '=', uid).orderBy('effectiveDate', 'DESC')
      )
      return {
        success: true,
        data: {
          exportDate: new Date().toISOString(),
          version: '1.0',
          members,
          records
        }
      }
    } catch (error) {
      return { success: false, error: '导出数据失败' }
    }
  }
}
