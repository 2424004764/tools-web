export interface HeightMember {
  id: string
  uid: string
  name: string
  birthDate: string | null
  sex: 'male' | 'female' | null
  goalHeight: number | null
  avatarColor: string
  avatarEmoji?: string
  isDefault: number
  createTime: string
  updateTime: string
}

export interface HeightRecord {
  id: string
  uid: string
  memberId: string
  height: number
  note: string
  recordDate: string
  recordTime: string
  createTime: string
  updateTime: string
  member?: HeightMember
}

export interface HeightReport {
  days: number
  startHeight: number
  endHeight: number
  change: number
  maxHeight: number
  minHeight: number
  avgHeight: number
  recordDays: number
}

export interface HeightStatistics {
  currentHeight: number | null
  lastHeight: number | null
  changeFromLast: number
  changeFromYesterday: number
  maxHeight: number | null
  minHeight: number | null
  avgHeight: number | null
  totalDays: number
  totalRecords: number
  consecutiveDays: number
  weeklyReport: HeightReport | null
  monthlyReport: HeightReport | null
  yearlyReport: HeightReport | null
  growthRate: number      // 年增长速率 cm/year
  goalDifference: number | null  // 与目标身高差值
  ageMonths: number | null
  predictedAdultHeight: number | null
}

export interface ChartDataPoint {
  date: string
  height: number
  memberId: string
}

export type TimeRange = '7' | '30' | '90' | '365' | 'all'

// 备注标签
export const NOTE_TAGS = [
  { label: '晨起', value: 'morning', color: '#67C23A' },
  { label: '睡前', value: 'night', color: '#909399' },
  { label: '运动后', value: 'exercise', color: '#409EFF' },
  { label: '体检', value: 'checkup', color: '#E6A23C' },
  { label: '穿鞋', value: 'withshoes', color: '#F56C6C' },
]

// 里程碑成就（基于身高 cm）
export const HEIGHT_MILESTONES = [
  { height: 80, label: '80cm', desc: '蹒跚学步', icon: '👶' },
  { height: 100, label: '1米', desc: '身高破1米', icon: '🎈' },
  { height: 120, label: '1.2米', desc: '一米二', icon: '🌱' },
  { height: 140, label: '1.4米', desc: '一米四', icon: '🍀' },
  { height: 150, label: '1.5米', desc: '一米五', icon: '🌟' },
  { height: 160, label: '1.6米', desc: '一米六', icon: '✨' },
  { height: 170, label: '1.7米', desc: '一米七', icon: '💫' },
  { height: 180, label: '1.8米', desc: '一米八', icon: '🏆' },
  { height: 190, label: '1.9米', desc: '一米九', icon: '👑' },
]

// 成就类型
export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
}