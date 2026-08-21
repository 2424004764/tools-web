import { FixedExpenseModel, QueryBuilder } from '../utils/db.js'

const DEFAULT_STATISTICS = {
  totalCount: 0,             // 总项目数
  activeCount: 0,            // 当前生效项目数
  monthlyTotal: 0,           // 月度总开销
  yearlyTotal: 0,            // 年度总开销（月度 × 12）
  byCategory: [],            // 分类汇总 [{ category, amount, percentage, count }]
  nextBilling: null,         // 下一笔扣款 { name, amount, billingDay, date }
  upcoming: [],              // 未来 7 天内扣款的项目
  averagePerItem: 0,         // 平均每个项目
  maxItem: null,             // 单项最大 { name, amount }
  minItem: null              // 单项最小 { name, amount }
}

// 预设分类
const CATEGORY_COLORS = {
  housing: '#F56C6C',
  subscription: '#409EFF',
  insurance: '#67C23A',
  transport: '#E6A23C',
  loan: '#C71585',
  education: '#909399',
  utility: '#00CED1',
  other: '#FF69B4'
}

export class FixedExpenseService {
  constructor(db) {
    this.db = db
    this.model = new FixedExpenseModel(db)
  }

  // ===== 列表 =====

  async getAll(uid, options = {}) {
    try {
      const { isActive, category } = options
      const qb = new QueryBuilder().where('uid', '=', uid)
      if (isActive !== undefined) qb.where('isActive', '=', isActive)
      if (category) qb.where('category', '=', category)
      qb.orderBy('billingDay', 'ASC').orderBy('createTime', 'DESC')
      const items = await this.model.findAll(qb)
      return { success: true, data: items }
    } catch (error) {
      console.error('fixedExpense getAll error:', error)
      return { success: false, error: '获取开销列表失败' }
    }
  }

  async getById(id, uid) {
    try {
      const item = await this.model.findOne(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: item }
    } catch (error) {
      return { success: false, error: '获取开销详情失败' }
    }
  }

  // ===== 增删改 =====

  async create(data, uid) {
    try {
      const startDate = data.startDate || new Date().toISOString().split('T')[0]
      const result = await this.model.create({
        uid,
        name: data.name.trim(),
        amount: data.amount,
        category: data.category || null,
        billingDay: data.billingDay || null,
        startDate,
        endDate: data.endDate || null,
        note: data.note || '',
        isActive: data.isActive === undefined ? 1 : (data.isActive ? 1 : 0)
      })
      return { success: true, data: { id: result.id, message: '添加成功' } }
    } catch (error) {
      console.error('fixedExpense create error:', error)
      return { success: false, error: '添加开销失败' }
    }
  }

  async update(id, data, uid) {
    try {
      const updateData = {}
      if (data.name !== undefined) updateData.name = data.name.trim()
      if (data.amount !== undefined) updateData.amount = data.amount
      if (data.category !== undefined) updateData.category = data.category || null
      if (data.billingDay !== undefined) updateData.billingDay = data.billingDay || null
      if (data.startDate !== undefined) updateData.startDate = data.startDate
      if (data.endDate !== undefined) updateData.endDate = data.endDate || null
      if (data.note !== undefined) updateData.note = data.note
      if (data.isActive !== undefined) updateData.isActive = data.isActive ? 1 : 0

      const ok = await this.model.updateWithQuery(
        updateData,
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: { updated: ok, message: ok ? '更新成功' : '记录不存在或无权限' } }
    } catch (error) {
      console.error('fixedExpense update error:', error)
      return { success: false, error: '更新开销失败' }
    }
  }

  async delete(id, uid) {
    try {
      const ok = await this.model.deleteWithQuery(
        new QueryBuilder().where('id', '=', id).where('uid', '=', uid)
      )
      return { success: true, data: { deleted: ok, message: ok ? '删除成功' : '记录不存在或无权限' } }
    } catch (error) {
      console.error('fixedExpense delete error:', error)
      return { success: false, error: '删除开销失败' }
    }
  }

  // ===== 统计 =====

  // 判断一项开销在指定月份是否生效（startDate <= 该月底 且（endDate 为空 或 endDate >= 该月头））
  isItemActiveInMonth(item, year, month) {
    // month 1-12
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEndDate = new Date(year, month, 0).getDate()
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(monthEndDate).padStart(2, '0')}`
    if (!item.startDate || item.startDate > monthEnd) return false
    if (item.endDate && item.endDate < monthStart) return false
    return true
  }

  async getStatistics(uid) {
    try {
      const items = await this.model.findAll(
        new QueryBuilder().where('uid', '=', uid)
      )

      if (items.length === 0) {
        return { success: true, data: { ...DEFAULT_STATISTICS } }
      }

      const now = new Date()
      const curYear = now.getFullYear()
      const curMonth = now.getMonth() + 1
      const today = now.toISOString().split('T')[0]
      const monthStart = `${curYear}-${String(curMonth).padStart(2, '0')}-01`
      const monthEndDate = new Date(curYear, curMonth, 0).getDate()
      const monthEnd = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(monthEndDate).padStart(2, '0')}`

      // 当月有效的项目
      const activeInMonth = items.filter(i => this.isItemActiveInMonth(i, curYear, curMonth) && i.isActive === 1)
      const activeItems = items.filter(i => i.isActive === 1)

      const monthlyTotal = parseFloat(activeInMonth.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2))
      const yearlyTotal = parseFloat((monthlyTotal * 12).toFixed(2))

      // 分类汇总（基于当月生效项目）
      const categoryMap = new Map()
      activeInMonth.forEach(i => {
        const cat = i.category || '其他'
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + (i.amount || 0))
      })
      const byCategory = [...categoryMap.entries()]
        .map(([category, amount]) => ({
          category,
          amount: parseFloat(amount.toFixed(2)),
          percentage: monthlyTotal > 0 ? parseFloat(((amount / monthlyTotal) * 100).toFixed(2)) : 0,
          count: activeInMonth.filter(i => (i.category || '其他') === category).length,
          color: CATEGORY_COLORS[category] || CATEGORY_COLORS.other
        }))
        .sort((a, b) => b.amount - a.amount)

      // 下一笔扣款（基于今天）
      const upcoming = activeItems
        .filter(i => i.billingDay)
        .map(i => {
          let day = i.billingDay
          let targetYear = curYear
          let targetMonth = curMonth
          if (day < now.getDate()) {
            // 跨月
            targetMonth++
            if (targetMonth > 12) {
              targetMonth = 1
              targetYear++
            }
          }
          const lastDay = new Date(targetYear, targetMonth, 0).getDate()
          day = Math.min(day, lastDay)
          const date = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          return { id: i.id, name: i.name, amount: i.amount, billingDay: i.billingDay, date }
        })
        .sort((a, b) => a.date.localeCompare(b.date))

      // 未来 7 天
      const sevenDaysLater = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0]
      const upcomingWeek = upcoming.filter(u => u.date >= today && u.date <= sevenDaysLater).slice(0, 5)

      const nextBilling = upcoming.length > 0 ? upcoming[0] : null

      const averagePerItem = activeInMonth.length > 0
        ? parseFloat((monthlyTotal / activeInMonth.length).toFixed(2))
        : 0

      const sortedByAmount = [...activeInMonth].sort((a, b) => b.amount - a.amount)
      const maxItem = sortedByAmount.length > 0
        ? { name: sortedByAmount[0].name, amount: sortedByAmount[0].amount }
        : null
      const minItem = sortedByAmount.length > 0
        ? { name: sortedByAmount[sortedByAmount.length - 1].name, amount: sortedByAmount[sortedByAmount.length - 1].amount }
        : null

      return {
        success: true,
        data: {
          totalCount: items.length,
          activeCount: activeInMonth.length,
          monthlyTotal,
          yearlyTotal,
          byCategory,
          nextBilling,
          upcoming: upcomingWeek,
          averagePerItem,
          maxItem,
          minItem,
          currentMonth: `${curYear}-${String(curMonth).padStart(2, '0')}`
        }
      }
    } catch (error) {
      console.error('fixedExpense getStatistics error:', error)
      return { success: false, error: '获取统计数据失败' }
    }
  }

  async exportData(uid) {
    try {
      const items = await this.model.findAll(
        new QueryBuilder().where('uid', '=', uid).orderBy('billingDay', 'ASC')
      )
      return {
        success: true,
        data: {
          exportDate: new Date().toISOString(),
          version: '1.0',
          expenses: items
        }
      }
    } catch (error) {
      console.error('fixedExpense export error:', error)
      return { success: false, error: '导出数据失败' }
    }
  }
}
