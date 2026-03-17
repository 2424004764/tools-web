export interface WeightMember {
  id: string
  uid: string
  name: string
  height: number | null
  goalWeight: number | null
  avatarColor: string
  avatarEmoji?: string
  isDefault: number
  createTime: string
  updateTime: string
}

export interface WeightRecord {
  id: string
  uid: string
  memberId: string
  weight: number
  height: number | null
  note: string
  recordDate: string
  recordTime: string
  createTime: string
  updateTime: string
  member?: WeightMember
}

export interface WeightReport {
  days: number
  startWeight: number
  endWeight: number
  change: number
  maxWeight: number
  minWeight: number
  avgWeight: number
  recordDays: number
}

export interface WeightStatistics {
  currentWeight: number | null
  lastWeight: number | null
  changeFromLast: number
  changeFromYesterday: number
  maxWeight: number | null
  minWeight: number | null
  avgWeight: number | null
  totalDays: number
  totalRecords: number
  consecutiveDays: number
  weeklyReport: WeightReport | null
  monthlyReport: WeightReport | null
  weeklyChangeRate: number
  monthlyChangeRate: number
  bmr: number | null
  healthyRange: {
    minWeight: number
    maxWeight: number
  } | null
}

export interface ChartDataPoint {
  date: string
  weight: number
  memberId: string
}

export type TimeRange = '7' | '30' | '90' | 'all'
export type WeightUnit = 'jin' | 'kg'

export interface HealthyRange {
  minWeight: number
  maxWeight: number
}

// 备注标签
export const NOTE_TAGS = [
  { label: '运动后', value: 'exercise', color: '#67C23A' },
  { label: '吃多了', value: 'overeat', color: '#E6A23C' },
  { label: '经期', value: 'period', color: '#F56C6C' },
  { label: '生病', value: 'sick', color: '#909399' },
  { label: '聚餐', value: 'party', color: '#409EFF' },
]

// 成就类型
export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: string
}
