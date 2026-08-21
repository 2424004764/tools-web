export interface SalaryRecord {
  id: string
  uid: string
  memberId: string | null
  monthlyIncome: number
  effectiveDate: string
  source: string | null
  note: string
  createTime: string
  updateTime: string
}

export interface SalaryMember {
  id: string
  uid: string
  name: string
  avatarColor: string | null
  avatarEmoji: string | null
  isDefault: number
  createTime: string
  updateTime: string
}

export interface SalaryYearlyReport {
  year: number
  recordCount: number
  startIncome: number
  endIncome: number
  changeAmount: number
  changePercent: number
  maxIncome: number
  minIncome: number
  firstChangeDate: string
  lastChangeDate: string
}

export interface SalaryStatistics {
  currentSalary: number | null
  lastSalary: number | null
  changeAmount: number
  changePercent: number
  totalRecords: number
  totalRaises: number
  totalCuts: number
  avgSalary: number | null
  maxSalary: number | null
  minSalary: number | null
  yearsCovered: number
  firstRecordDate: string | null
  currentTenureMonths: number
  annualizedGrowth: number        // %/年
  yearlyReport: SalaryYearlyReport | null
}

export interface ChartDataPoint {
  date: string
  income: number
  id: string
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
}

// 薪资里程碑（元/月）
export const SALARY_MILESTONES = [
  { income: 5000, label: '5K', desc: '月薪破5千', icon: '🌱' },
  { income: 8000, label: '8K', desc: '月薪破8千', icon: '🍀' },
  { income: 10000, label: '1万', desc: '月薪破1万', icon: '⭐' },
  { income: 15000, label: '1.5万', desc: '月薪破1.5万', icon: '🌟' },
  { income: 20000, label: '2万', desc: '月薪破2万', icon: '✨' },
  { income: 30000, label: '3万', desc: '月薪破3万', icon: '💫' },
  { income: 50000, label: '5万', desc: '月薪破5万', icon: '🏆' },
  { income: 80000, label: '8万', desc: '月薪破8万', icon: '👑' },
  { income: 100000, label: '10万', desc: '月薪破10万', icon: '💎' },
]

// 调薪原因标签
export const REASON_TAGS = [
  { label: '年度调薪', value: 'annual', color: '#67C23A' },
  { label: '晋升', value: 'promotion', color: '#409EFF' },
  { label: '跳槽', value: 'jobhop', color: '#E6A23C' },
  { label: '绩效奖金', value: 'bonus', color: '#F56C6C' },
  { label: '转正', value: 'regular', color: '#909399' },
  { label: '降薪', value: 'cut', color: '#C71585' },
]

// 成员头像颜色板（与后端 MEMBER_COLORS 对齐）
export const MEMBER_COLORS = [
  '#409EFF', '#67C23A', '#E6A23C', '#F56C6C',
  '#909399', '#C71585', '#FF69B4', '#8A2BE2',
  '#00CED1', '#32CD32', '#FFD700', '#FF4500'
]

// 成员默认 emoji 头像
export const MEMBER_EMOJIS = ['👤', '👨', '👩', '🧑', '👨‍💼', '👩‍💼', '🧔', '👱‍♀️', '👱', '🧑‍💻']