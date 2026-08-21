import { HeightRecordModel, HeightMemberModel, QueryBuilder } from '../utils/db.js'

// 默认统计数据结构
const DEFAULT_STATISTICS = {
  currentHeight: null,
  lastHeight: null,
  changeFromLast: 0,
  changeFromYesterday: 0,
  maxHeight: null,
  minHeight: null,
  avgHeight: null,
  totalDays: 0,
  totalRecords: 0,
  consecutiveDays: 0,
  weeklyReport: null,
  monthlyReport: null,
  yearlyReport: null,
  growthRate: 0,           // 年增长速率（cm/年）
  goalDifference: null,    // 与目标身高的差值（cm）
  ageMonths: null,         // 当前年龄（月）
  predictedAdultHeight: null  // 预测成年身高（cm，简化公式）
}

export class HeightService {
  constructor(db) {
    this.db = db
    this.recordModel = new HeightRecordModel(db)
    this.memberModel = new HeightMemberModel(db)
  }

  // ===== 成员管理 =====

  async getAllMembers(uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('isDefault', 'DESC')
        .orderBy('createTime', 'ASC')

      const members = await this.memberModel.findAll(queryBuilder)

      return { success: true, data: members }
    } catch (error) {
      return { success: false, error: '获取成员列表失败' }
    }
  }

  async getMemberById(id, uid) {
    try {
      const member = await this.memberModel.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )
      return { success: true, data: member }
    } catch (error) {
      return { success: false, error: '获取成员详情失败' }
    }
  }

  async createMember(memberData, uid) {
    try {
      const name = memberData.name.trim()

      // 检查是否已存在相同名称的成员
      const existingMember = await this.memberModel.findOne(
        new QueryBuilder()
          .where('uid', '=', uid)
          .where('name', '=', name)
      )

      if (existingMember) {
        const updateData = {}
        if (memberData.birthDate !== undefined) updateData.birthDate = memberData.birthDate || null
        if (memberData.sex !== undefined) updateData.sex = memberData.sex || null
        if (memberData.goalHeight !== undefined) updateData.goalHeight = memberData.goalHeight
        if (memberData.avatarColor !== undefined) updateData.avatarColor = memberData.avatarColor
        if (memberData.avatarEmoji !== undefined) updateData.avatarEmoji = memberData.avatarEmoji

        const queryBuilder = new QueryBuilder()
          .where('id', '=', existingMember.id)
          .where('uid', '=', uid)

        await this.memberModel.updateWithQuery(updateData, queryBuilder)

        return {
          success: true,
          data: { id: existingMember.id, updated: true, message: '成员更新成功' }
        }
      }

      // 新建成员
      if (memberData.isDefault) {
        await this.db.prepare(
          'UPDATE height_members SET is_default = 0 WHERE uid = ?'
        ).bind(uid).run()
      }

      const result = await this.memberModel.create({
        name,
        birthDate: memberData.birthDate || null,
        sex: memberData.sex || null,
        goalHeight: memberData.goalHeight || null,
        avatarColor: memberData.avatarColor || this.getRandomColor(),
        avatarEmoji: memberData.avatarEmoji || null,
        isDefault: memberData.isDefault ? 1 : 0,
        uid
      })

      return {
        success: true,
        data: { id: result.id, updated: false, message: '成员创建成功' }
      }
    } catch (error) {
      return { success: false, error: '创建/更新成员失败' }
    }
  }

  async updateMember(id, memberData, uid) {
    try {
      const updateData = {}
      if (memberData.name !== undefined) updateData.name = memberData.name.trim()
      if (memberData.birthDate !== undefined) updateData.birthDate = memberData.birthDate || null
      if (memberData.sex !== undefined) updateData.sex = memberData.sex || null
      if (memberData.goalHeight !== undefined) updateData.goalHeight = memberData.goalHeight
      if (memberData.avatarColor !== undefined) updateData.avatarColor = memberData.avatarColor
      if (memberData.avatarEmoji !== undefined) updateData.avatarEmoji = memberData.avatarEmoji
      if (memberData.isDefault !== undefined) {
        if (memberData.isDefault) {
          await this.db.prepare(
            'UPDATE height_members SET is_default = 0 WHERE uid = ? AND id != ?'
          ).bind(uid, id).run()
        }
        updateData.isDefault = memberData.isDefault ? 1 : 0
      }

      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const updateSuccess = await this.memberModel.updateWithQuery(updateData, queryBuilder)
      return {
        success: true,
        data: {
          updated: updateSuccess,
          message: updateSuccess ? '成员更新成功' : '成员不存在或无权限'
        }
      }
    } catch (error) {
      return { success: false, error: '更新成员失败' }
    }
  }

  async deleteMember(id, uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      // 先删除该成员的所有身高记录
      const recordsQueryBuilder = new QueryBuilder().where('memberId', '=', id)
      const records = await this.recordModel.findAll(recordsQueryBuilder)

      for (const record of records) {
        const recordQueryBuilder = new QueryBuilder()
          .where('id', '=', record.id)
          .where('uid', '=', uid)
        await this.recordModel.deleteWithQuery(recordQueryBuilder)
      }

      const deleteSuccess = await this.memberModel.deleteWithQuery(queryBuilder)

      return {
        success: true,
        data: {
          deleted: deleteSuccess,
          deletedRecords: records.length,
          message: deleteSuccess ? '成员删除成功' : '成员不存在或无权限'
        }
      }
    } catch (error) {
      return { success: false, error: '删除成员失败' }
    }
  }

  // ===== 身高记录操作 =====

  async getAllRecords(uid, options = {}) {
    try {
      const { memberId, startDate, endDate, limit } = options
      const queryBuilder = new QueryBuilder().where('uid', '=', uid)

      if (memberId) queryBuilder.where('memberId', '=', memberId)
      if (startDate) queryBuilder.where('recordDate', '>=', startDate)
      if (endDate) queryBuilder.where('recordDate', '<=', endDate)

      queryBuilder.orderBy('recordDate', 'DESC').orderBy('height', 'DESC')
      if (limit) queryBuilder.limit(limit)

      const records = await this.recordModel.findAll(queryBuilder)
      return { success: true, data: records }
    } catch (error) {
      return { success: false, error: '获取身高记录失败' }
    }
  }

  async getRecordById(id, uid) {
    try {
      const record = await this.recordModel.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )
      return { success: true, data: record }
    } catch (error) {
      return { success: false, error: '获取身高记录详情失败' }
    }
  }

  async createRecord(recordData, uid) {
    try {
      const now = new Date()
      const recordDate = recordData.recordDate || now.toISOString().split('T')[0]
      const recordTime = recordData.recordTime || now.toTimeString().slice(0, 5)

      const result = await this.recordModel.create({
        memberId: recordData.memberId,
        height: recordData.height,
        note: recordData.note || '',
        recordDate,
        recordTime,
        uid
      })

      return {
        success: true,
        data: { id: result.id, message: '身高记录创建成功' }
      }
    } catch (error) {
      return { success: false, error: '创建身高记录失败' }
    }
  }

  async updateRecord(id, recordData, uid) {
    try {
      const updateData = {}
      if (recordData.height !== undefined) updateData.height = recordData.height
      if (recordData.note !== undefined) updateData.note = recordData.note
      if (recordData.recordDate !== undefined) updateData.recordDate = recordData.recordDate
      if (recordData.recordTime !== undefined) updateData.recordTime = recordData.recordTime
      if (recordData.memberId !== undefined) updateData.memberId = recordData.memberId

      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const updateSuccess = await this.recordModel.updateWithQuery(updateData, queryBuilder)
      return {
        success: true,
        data: {
          updated: updateSuccess,
          message: updateSuccess ? '身高记录更新成功' : '身高记录不存在或无权限'
        }
      }
    } catch (error) {
      return { success: false, error: '更新身高记录失败' }
    }
  }

  async deleteRecord(id, uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const deleteSuccess = await this.recordModel.deleteWithQuery(queryBuilder)
      return {
        success: true,
        data: {
          deleted: deleteSuccess,
          message: deleteSuccess ? '身高记录删除成功' : '身高记录不存在或无权限'
        }
      }
    } catch (error) {
      return { success: false, error: '删除身高记录失败' }
    }
  }

  // ===== 工具方法 =====

  // 计算连续记录天数
  calculateConsecutiveDays(records) {
    if (records.length === 0) return 0

    const uniqueDates = [...new Set(records.map(r => r.recordDate))].sort().reverse()
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0

    let consecutiveDays = 0
    let checkDate = uniqueDates[0]

    for (let i = 0; i < uniqueDates.length; i++) {
      if (uniqueDates[i] === checkDate) {
        consecutiveDays++
        const nextDate = new Date(checkDate)
        nextDate.setDate(nextDate.getDate() - 1)
        checkDate = nextDate.toISOString().split('T')[0]
      } else {
        break
      }
    }

    return consecutiveDays
  }

  // 生成周报/月报/年报
  generateReport(records, days) {
    if (records.length === 0) return null

    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const filteredRecords = records.filter(r => r.recordDate >= startDateStr)
    if (filteredRecords.length === 0) return null

    // 按日期分组取每天最高的记录
    const dailyRecords = new Map()
    for (const record of filteredRecords) {
      const existing = dailyRecords.get(record.recordDate)
      if (!existing || record.height > existing.height) {
        dailyRecords.set(record.recordDate, record)
      }
    }
    const sortedDailyRecords = Array.from(dailyRecords.values()).sort((a, b) =>
      a.recordDate.localeCompare(b.recordDate)
    )

    const heights = sortedDailyRecords.map(r => r.height)
    const startHeight = heights[0]
    const endHeight = heights[heights.length - 1]
    const maxHeight = Math.max(...heights)
    const minHeight = Math.min(...heights)
    const avgHeight = heights.reduce((sum, h) => sum + h, 0) / heights.length

    return {
      days,
      startHeight,
      endHeight,
      change: parseFloat((endHeight - startHeight).toFixed(2)),
      maxHeight,
      minHeight,
      avgHeight: parseFloat(avgHeight.toFixed(2)),
      recordDays: sortedDailyRecords.length
    }
  }

  // 计算年龄（月数）
  calculateAgeMonths(birthDate) {
    if (!birthDate) return null
    const birth = new Date(birthDate)
    if (isNaN(birth.getTime())) return null
    const now = new Date()
    const months = (now.getFullYear() - birth.getFullYear()) * 12 +
                   (now.getMonth() - birth.getMonth())
    return months >= 0 ? months : null
  }

  // 计算当前年龄（岁）
  calculateAge(birthDate) {
    const months = this.calculateAgeMonths(birthDate)
    return months === null ? null : months / 12
  }

  // 简化版预测成年身高（仅供娱乐/参考）
  // 基于儿童当前身高、年龄、性别，使用回归近似（基于WHO儿童生长曲线与TPH法简化）
  // 实际预测需结合父母身高、骨龄等多因素，这里给出粗略公式
  predictAdultHeight(currentHeight, birthDate, sex) {
    const age = this.calculateAge(birthDate)
    if (age === null || age >= 18 || age < 2) return null
    // 简化：成人在18岁的身高约为当前身高的比例因子（年龄越小预测越不准）
    // 2岁: ≈0.50, 5岁: ≈0.62, 10岁: ≈0.78, 14岁: ≈0.92, 16岁: ≈0.97
    // 基于WHO 50百分位数据简化插值
    const factor = this.getAdultHeightFactor(age, sex)
    return parseFloat((currentHeight / factor).toFixed(1))
  }

  // 根据年龄和性别估算「当前身高占成年身高的比例」
  getAdultHeightFactor(age, sex) {
    // 基于WHO儿童身高发育中位数（50th percentile）的简化数据
    // 数组按年龄(岁)索引：[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17]
    const maleFactors = [0.50, 0.55, 0.59, 0.63, 0.67, 0.70, 0.74, 0.77, 0.80, 0.83, 0.87, 0.91, 0.95, 0.97, 0.99, 1.00]
    const femaleFactors = [0.51, 0.56, 0.61, 0.65, 0.69, 0.73, 0.77, 0.81, 0.85, 0.89, 0.93, 0.96, 0.98, 0.99, 1.00, 1.00]
    const factors = sex === 'female' ? femaleFactors : maleFactors
    const idx = Math.min(Math.max(Math.floor(age) - 2, 0), factors.length - 1)
    return factors[idx]
  }

  // 计算年增长速率（cm/年）
  calculateGrowthRate(records) {
    if (records.length < 2) return 0
    // 排序：按日期正序
    const sorted = [...records].sort((a, b) => a.recordDate.localeCompare(b.recordDate))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const heightDiff = last.height - first.height
    const dayDiff = (new Date(last.recordDate).getTime() - new Date(first.recordDate).getTime()) / 86400000
    if (dayDiff <= 0) return 0
    return parseFloat(((heightDiff / dayDiff) * 365).toFixed(2))
  }

  // 计算目标差距
  calculateGoalDifference(currentHeight, goalHeight) {
    if (!goalHeight || currentHeight === null || currentHeight === undefined) return null
    return parseFloat((currentHeight - goalHeight).toFixed(2))
  }

  // 获取统计数据
  async getStatistics(uid, memberId) {
    try {
      const queryBuilder = new QueryBuilder().where('uid', '=', uid)
      if (memberId) queryBuilder.where('memberId', '=', memberId)

      const records = await this.recordModel.findAll(queryBuilder)

      if (records.length === 0) {
        return { success: true, data: { ...DEFAULT_STATISTICS } }
      }

      // 获取成员信息
      let member = null
      if (memberId) {
        member = await this.memberModel.findOne(
          new QueryBuilder().where('id', '=', memberId)
        )
      }

      // 按日期时间正序
      records.sort((a, b) => {
        if (a.recordDate !== b.recordDate) return a.recordDate.localeCompare(b.recordDate)
        return a.recordTime.localeCompare(b.recordTime)
      })

      const currentHeight = records[records.length - 1].height
      const lastHeight = records.length > 1 ? records[records.length - 2].height : currentHeight
      const changeFromLast = parseFloat((currentHeight - lastHeight).toFixed(2))

      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const yesterdayRecords = records.filter(r => r.recordDate === yesterday)
      const yesterdayHeight = yesterdayRecords.length > 0
        ? yesterdayRecords[yesterdayRecords.length - 1].height
        : null
      const changeFromYesterday = yesterdayHeight !== null
        ? parseFloat((currentHeight - yesterdayHeight).toFixed(2))
        : 0

      const heights = records.map(r => r.height)
      const maxHeight = Math.max(...heights)
      const minHeight = Math.min(...heights)
      const avgHeight = parseFloat((heights.reduce((sum, h) => sum + h, 0) / heights.length).toFixed(2))

      const uniqueDays = new Set(records.map(r => r.recordDate)).size
      const consecutiveDays = this.calculateConsecutiveDays(records)

      const weeklyReport = this.generateReport(records, 7)
      const monthlyReport = this.generateReport(records, 30)
      const yearlyReport = this.generateReport(records, 365)

      const growthRate = this.calculateGrowthRate(records)
      const goalDifference = member?.goalHeight ? this.calculateGoalDifference(currentHeight, member.goalHeight) : null
      const ageMonths = member?.birthDate ? this.calculateAgeMonths(member.birthDate) : null
      const predictedAdultHeight = member?.birthDate && member?.sex
        ? this.predictAdultHeight(currentHeight, member.birthDate, member.sex)
        : null

      return {
        success: true,
        data: {
          currentHeight,
          lastHeight,
          changeFromLast,
          changeFromYesterday,
          maxHeight,
          minHeight,
          avgHeight,
          totalDays: uniqueDays,
          totalRecords: records.length,
          consecutiveDays,
          weeklyReport,
          monthlyReport,
          yearlyReport,
          growthRate,
          goalDifference,
          ageMonths,
          predictedAdultHeight
        }
      }
    } catch (error) {
      return { success: false, error: '获取统计数据失败' }
    }
  }

  // 获取图表数据
  async getChartData(uid, memberId, days = 30) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const startDateStr = startDate.toISOString().split('T')[0]

      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .where('recordDate', '>=', startDateStr)

      if (memberId) queryBuilder.where('memberId', '=', memberId)

      queryBuilder.orderBy('recordDate', 'ASC').orderBy('recordTime', 'ASC')

      const records = await this.recordModel.findAll(queryBuilder)

      // 按日期分组取每天最高值
      const dailyData = new Map()
      for (const record of records) {
        const existing = dailyData.get(record.recordDate)
        if (!existing || record.height > existing.height) {
          dailyData.set(record.recordDate, {
            date: record.recordDate,
            height: record.height,
            memberId: record.memberId
          })
        }
      }

      return { success: true, data: Array.from(dailyData.values()) }
    } catch (error) {
      return { success: false, error: '获取图表数据失败' }
    }
  }

  // 随机颜色
  getRandomColor() {
    const colors = [
      '#409EFF', '#67C23A', '#E6A23C', '#F56C6C',
      '#909399', '#C71585', '#FF69B4', '#8A2BE2',
      '#00CED1', '#32CD32', '#FFD700', '#FF4500'
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  // 导出数据
  async exportData(uid) {
    try {
      const members = await this.memberModel.findAll(
        new QueryBuilder().where('uid', '=', uid)
      )
      const records = await this.recordModel.findAll(
        new QueryBuilder().where('uid', '=', uid).orderBy('recordDate', 'DESC')
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