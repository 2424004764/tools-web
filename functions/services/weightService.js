import { WeightRecordModel, WeightMemberModel, QueryBuilder } from '../utils/db.js'

// 默认统计数据结构
const DEFAULT_STATISTICS = {
  currentWeight: null,
  lastWeight: null,
  changeFromLast: 0,
  changeFromYesterday: 0,
  maxWeight: null,
  minWeight: null,
  avgWeight: null,
  totalDays: 0,
  totalRecords: 0,
  consecutiveDays: 0,
  weeklyReport: null,
  monthlyReport: null,
  weeklyChangeRate: 0,  // 周变化速度（斤/周）
  monthlyChangeRate: 0, // 月变化速度（斤/月）
  bmr: null,            // 基础代谢率
  healthyRange: null    // 健康体重区间
}

export class WeightService {
  constructor(db) {
    this.db = db
    this.recordModel = new WeightRecordModel(db)
    this.memberModel = new WeightMemberModel(db)
  }

  // ===== 成员管理 =====

  // 获取当前用户的所有成员
  async getAllMembers(uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)
        .orderBy('is_default', 'DESC')
        .orderBy('create_time', 'ASC')

      const members = await this.memberModel.findAll(queryBuilder)

      return {
        success: true,
        data: members
      }
    } catch (error) {
      return { success: false, error: '获取成员列表失败' }
    }
  }

  // 根据ID获取成员
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

  // 创建或更新成员（根据名称判断是否存在）
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
        // 已存在，更新成员
        const updateData = {}
        if (memberData.height !== undefined) {
          updateData.height = memberData.height
        }
        if (memberData.goalWeight !== undefined) {
          updateData.goalWeight = memberData.goalWeight
        }
        if (memberData.avatarColor !== undefined) {
          updateData.avatarColor = memberData.avatarColor
        }
        if (memberData.avatarEmoji !== undefined) {
          updateData.avatarEmoji = memberData.avatarEmoji
        }

        const queryBuilder = new QueryBuilder()
          .where('id', '=', existingMember.id)
          .where('uid', '=', uid)

        await this.memberModel.updateWithQuery(updateData, queryBuilder)

        return {
          success: true,
          data: {
            id: existingMember.id,
            updated: true,
            message: '成员更新成功'
          }
        }
      }

      // 不存在，创建新成员
      // 如果创建的是默认成员，需要先取消其他成员的默认状态
      if (memberData.isDefault) {
        await this.db.prepare(
          'UPDATE weight_members SET is_default = 0 WHERE uid = ?'
        ).bind(uid).run()
      }

      const result = await this.memberModel.create({
        name: name,
        height: memberData.height || null,
        goalWeight: memberData.goalWeight || null,
        avatarColor: memberData.avatarColor || this.getRandomColor(),
        avatarEmoji: memberData.avatarEmoji || null,
        isDefault: memberData.isDefault ? 1 : 0,
        uid: uid
      })
      return {
        success: true,
        data: {
          id: result.id,
          updated: false,
          message: '成员创建成功'
        }
      }
    } catch (error) {
      return { success: false, error: '创建/更新成员失败' }
    }
  }

  // 更新成员
  async updateMember(id, memberData, uid) {
    try {
      const updateData = {}
      if (memberData.name !== undefined) {
        updateData.name = memberData.name.trim()
      }
      if (memberData.height !== undefined) {
        updateData.height = memberData.height
      }
      if (memberData.goalWeight !== undefined) {
        updateData.goalWeight = memberData.goalWeight
      }
      if (memberData.avatarColor !== undefined) {
        updateData.avatarColor = memberData.avatarColor
      }
      if (memberData.avatarEmoji !== undefined) {
        updateData.avatarEmoji = memberData.avatarEmoji
      }
      if (memberData.isDefault !== undefined) {
        // 如果设置为默认成员，需要先取消其他成员的默认状态
        if (memberData.isDefault) {
          await this.db.prepare(
            'UPDATE weight_members SET is_default = 0 WHERE uid = ? AND id != ?'
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

  // 删除成员
  async deleteMember(id, uid) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      // 先删除该成员的所有体重记录
      const recordsQueryBuilder = new QueryBuilder().where('member_id', '=', id)
      const records = await this.recordModel.findAll(recordsQueryBuilder)

      for (const record of records) {
        const recordQueryBuilder = new QueryBuilder()
          .where('id', '=', record.id)
          .where('uid', '=', uid)
        await this.recordModel.deleteWithQuery(recordQueryBuilder)
      }

      // 再删除成员
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

  // ===== 体重记录操作 =====

  // 获取体重记录列表
  async getAllRecords(uid, options = {}) {
    try {
      const { memberId, startDate, endDate, limit } = options

      const queryBuilder = new QueryBuilder().where('uid', '=', uid)

      // 按成员过滤
      if (memberId) {
        queryBuilder.where('member_id', '=', memberId)
      }

      // 按日期范围过滤
      if (startDate) {
        queryBuilder.where('record_date', '>=', startDate)
      }
      if (endDate) {
        queryBuilder.where('record_date', '<=', endDate)
      }

      queryBuilder.orderBy('record_date', 'DESC').orderBy('weight', 'DESC')

      if (limit) {
        queryBuilder.limit(limit)
      }

      const records = await this.recordModel.findAll(queryBuilder)

      return {
        success: true,
        data: records
      }
    } catch (error) {
      return { success: false, error: '获取体重记录失败' }
    }
  }

  // 根据ID获取体重记录
  async getRecordById(id, uid) {
    try {
      const record = await this.recordModel.findOne(
        new QueryBuilder()
          .where('id', '=', id)
          .where('uid', '=', uid)
      )
      return { success: true, data: record }
    } catch (error) {
      return { success: false, error: '获取体重记录详情失败' }
    }
  }

  // 创建体重记录
  async createRecord(recordData, uid) {
    try {
      const now = new Date()
      const recordDate = recordData.recordDate || now.toISOString().split('T')[0]
      const recordTime = recordData.recordTime || now.toTimeString().slice(0, 5)

      const result = await this.recordModel.create({
        memberId: recordData.memberId,
        weight: recordData.weight,
        height: recordData.height || null,
        note: recordData.note || '',
        recordDate: recordDate,
        recordTime: recordTime,
        uid: uid
      })
      return {
        success: true,
        data: {
          id: result.id,
          message: '体重记录创建成功'
        }
      }
    } catch (error) {
      return { success: false, error: '创建体重记录失败' }
    }
  }

  // 更新体重记录
  async updateRecord(id, recordData, uid) {
    try {
      const updateData = {}
      if (recordData.weight !== undefined) {
        updateData.weight = recordData.weight
      }
      if (recordData.height !== undefined) {
        updateData.height = recordData.height
      }
      if (recordData.note !== undefined) {
        updateData.note = recordData.note
      }
      if (recordData.recordDate !== undefined) {
        updateData.recordDate = recordData.recordDate
      }
      if (recordData.recordTime !== undefined) {
        updateData.recordTime = recordData.recordTime
      }
      if (recordData.memberId !== undefined) {
        updateData.memberId = recordData.memberId
      }

      const queryBuilder = new QueryBuilder()
        .where('id', '=', id)
        .where('uid', '=', uid)

      const updateSuccess = await this.recordModel.updateWithQuery(updateData, queryBuilder)
      return {
        success: true,
        data: {
          updated: updateSuccess,
          message: updateSuccess ? '体重记录更新成功' : '体重记录不存在或无权限'
        }
      }
    } catch (error) {
      return { success: false, error: '更新体重记录失败' }
    }
  }

  // 删除体重记录
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
          message: deleteSuccess ? '体重记录删除成功' : '体重记录不存在或无权限'
        }
      }
    } catch (error) {
      return { success: false, error: '删除体重记录失败' }
    }
  }

  // ===== 统计功能 =====

  // 计算连续记录天数
  calculateConsecutiveDays(records) {
    if (records.length === 0) return 0

    // 获取所有唯一日期并排序（倒序）
    const uniqueDates = [...new Set(records.map(r => r.recordDate))].sort().reverse()
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // 检查最近是否有记录
    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
      return 0
    }

    let consecutiveDays = 0
    let checkDate = uniqueDates[0]

    for (let i = 0; i < uniqueDates.length; i++) {
      if (uniqueDates[i] === checkDate) {
        consecutiveDays++
        // 移到前一天
        const nextDate = new Date(checkDate)
        nextDate.setDate(nextDate.getDate() - 1)
        checkDate = nextDate.toISOString().split('T')[0]
      } else {
        break
      }
    }

    return consecutiveDays
  }

  // 生成周报/月报
  generateReport(records, days = 7) {
    if (records.length === 0) return null

    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    // 筛选指定天数内的记录
    const filteredRecords = records.filter(r => r.recordDate >= startDateStr)

    if (filteredRecords.length === 0) return null

    // 按日期分组，取每天的最后一条记录
    const dailyRecords = new Map()
    for (const record of filteredRecords) {
      dailyRecords.set(record.recordDate, record)
    }
    const sortedDailyRecords = Array.from(dailyRecords.values()).sort((a, b) =>
      a.recordDate.localeCompare(b.recordDate)
    )

    const weights = sortedDailyRecords.map(r => r.weight)
    const startWeight = weights[0]
    const endWeight = weights[weights.length - 1]
    const maxWeight = Math.max(...weights)
    const minWeight = Math.min(...weights)
    const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length

    return {
      days,
      startWeight,
      endWeight,
      change: parseFloat((endWeight - startWeight).toFixed(2)),
      maxWeight,
      minWeight,
      avgWeight: parseFloat(avgWeight.toFixed(2)),
      recordDays: sortedDailyRecords.length
    }
  }

  // 计算健康体重区间（基于BMI 18.5-24）
  calculateHealthyRange(height) {
    if (!height) return null
    const heightInM = height / 100
    const minWeightKg = 18.5 * heightInM * heightInM
    const maxWeightKg = 24 * heightInM * heightInM
    return {
      minWeight: parseFloat((minWeightKg * 2).toFixed(1)), // 转为斤
      maxWeight: parseFloat((maxWeightKg * 2).toFixed(1))
    }
  }

  // 获取统计数据
  async getStatistics(uid, memberId) {
    try {
      const queryBuilder = new QueryBuilder()
        .where('uid', '=', uid)

      if (memberId) {
        queryBuilder.where('member_id', '=', memberId)
      }

      const records = await this.recordModel.findAll(queryBuilder)

      if (records.length === 0) {
        return {
          success: true,
          data: { ...DEFAULT_STATISTICS }
        }
      }

      // 获取成员信息（用于BMR和健康区间计算）
      let member = null
      if (memberId) {
        const memberResult = await this.memberModel.findOne(
          new QueryBuilder().where('id', '=', memberId)
        )
        member = memberResult
      }

      // 按日期时间正序排序（用于计算变化）
      records.sort((a, b) => {
        if (a.recordDate !== b.recordDate) {
          return a.recordDate.localeCompare(b.recordDate)
        }
        return a.recordTime.localeCompare(b.recordTime)
      })

      const currentWeight = records[records.length - 1].weight
      const lastWeight = records.length > 1 ? records[records.length - 2].weight : currentWeight
      const changeFromLast = parseFloat((currentWeight - lastWeight).toFixed(2))

      // 计算较昨日变化
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const yesterdayRecords = records.filter(r => r.recordDate === yesterday)
      const yesterdayWeight = yesterdayRecords.length > 0
        ? yesterdayRecords[yesterdayRecords.length - 1].weight
        : null
      const changeFromYesterday = yesterdayWeight !== null
        ? parseFloat((currentWeight - yesterdayWeight).toFixed(2))
        : 0

      const weights = records.map(r => r.weight)
      const maxWeight = Math.max(...weights)
      const minWeight = Math.min(...weights)
      const avgWeight = parseFloat((weights.reduce((sum, w) => sum + w, 0) / weights.length).toFixed(2))

      // 统计唯一天数
      const uniqueDays = new Set(records.map(r => r.recordDate)).size

      // 连续记录天数
      const consecutiveDays = this.calculateConsecutiveDays(records)

      // 周报和月报
      const weeklyReport = this.generateReport(records, 7)
      const monthlyReport = this.generateReport(records, 30)

      // 计算变化速度（斤/周 或 斤/月）
      const weeklyChangeRate = weeklyReport ? weeklyReport.change / weeklyReport.recordDays * 7 : 0
      const monthlyChangeRate = monthlyReport ? monthlyReport.change / monthlyReport.recordDays * 30 : 0

      // 计算基础代谢率 (BMR) - Mifflin-St Jeor 公式，简化版本
      // BMR = 10 × 体重(kg) + 6.25 × 身高(cm) - 5 × 年龄 + 性别系数
      // 暂按30岁男性计算，后续可添加年龄和性别字段
      let bmr = null
      if (member?.height && currentWeight) {
        const weightInKg = currentWeight / 2
        const heightInCm = member.height
        const age = 30 // 默认年龄
        // 男性: +5, 女性: -161
        const genderFactor = 5
        bmr = Math.round(10 * weightInKg + 6.25 * heightInCm - 5 * age + genderFactor)
      }

      // 健康体重区间
      const healthyRange = member?.height ? this.calculateHealthyRange(member.height) : null

      return {
        success: true,
        data: {
          currentWeight,
          lastWeight,
          changeFromLast,
          changeFromYesterday,
          maxWeight,
          minWeight,
          avgWeight,
          totalDays: uniqueDays,
          totalRecords: records.length,
          consecutiveDays,
          weeklyReport,
          monthlyReport,
          weeklyChangeRate: parseFloat(weeklyChangeRate.toFixed(2)),
          monthlyChangeRate: parseFloat(monthlyChangeRate.toFixed(2)),
          bmr,
          healthyRange
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
        .where('record_date', '>=', startDateStr)

      if (memberId) {
        queryBuilder.where('member_id', '=', memberId)
      }

      queryBuilder.orderBy('record_date', 'ASC').orderBy('record_time', 'ASC')

      const records = await this.recordModel.findAll(queryBuilder)

      // 按日期分组，取每天的平均值或最后一条记录
      const dailyData = new Map()
      for (const record of records) {
        if (!dailyData.has(record.recordDate)) {
          dailyData.set(record.recordDate, { date: record.recordDate, weight: record.weight, memberId: record.memberId })
        }
      }

      const chartData = Array.from(dailyData.values())

      return {
        success: true,
        data: chartData
      }
    } catch (error) {
      return { success: false, error: '获取图表数据失败' }
    }
  }

  // 生成随机头像颜色
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
        new QueryBuilder().where('uid', '=', uid).orderBy('record_date', 'DESC')
      )

      return {
        success: true,
        data: {
          exportDate: new Date().toISOString(),
          version: '1.0',
          members: members,
          records: records
        }
      }
    } catch (error) {
      return { success: false, error: '导出数据失败' }
    }
  }
}
