export interface FixedExpense {
  id: string
  uid: string
  name: string
  amount: number
  category: string | null
  billingDay: number | null
  startDate: string
  endDate: string | null
  note: string
  isActive: number
  createTime: string
  updateTime: string
}

export interface FixedExpenseCategory {
  category: string
  amount: number
  percentage: number
  count: number
  color: string
}

export interface FixedExpenseStatistics {
  totalCount: number
  activeCount: number
  monthlyTotal: number
  yearlyTotal: number
  byCategory: FixedExpenseCategory[]
  nextBilling: {
    id: string
    name: string
    amount: number
    billingDay: number
    date: string
  } | null
  upcoming: Array<{
    id: string
    name: string
    amount: number
    billingDay: number
    date: string
  }>
  averagePerItem: number
  maxItem: { name: string; amount: number } | null
  minItem: { name: string; amount: number } | null
  currentMonth: string
}

export const EXPENSE_CATEGORIES: Array<{ value: string; label: string; color: string; emoji: string }> = [
  { value: 'housing', label: '住房', color: '#F56C6C', emoji: '🏠' },
  { value: 'subscription', label: '订阅', color: '#409EFF', emoji: '📱' },
  { value: 'insurance', label: '保险', color: '#67C23A', emoji: '🛡️' },
  { value: 'transport', label: '交通', color: '#E6A23C', emoji: '🚗' },
  { value: 'loan', label: '贷款', color: '#C71585', emoji: '💳' },
  { value: 'education', label: '教育', color: '#909399', emoji: '📚' },
  { value: 'utility', label: '水电', color: '#00CED1', emoji: '💡' },
  { value: 'other', label: '其他', color: '#FF69B4', emoji: '💰' }
]

export function getCategoryMeta(category: string | null | undefined): { color: string; emoji: string; label: string } {
  const found = EXPENSE_CATEGORIES.find(c => c.value === category)
  if (found) return { color: found.color, emoji: found.emoji, label: found.label }
  return { color: '#909399', emoji: '📦', label: category || '未分类' }
}
