export interface PriceEntry {
  id: string
  uid: string
  itemId: string
  platform: string
  unitPrice: number
  shippingFee: number
  discount: number
  finalPrice: number
  quantity: number
  currency: string
  status: number       // 0=待定 1=已下单 2=已到货 3=已取消
  purchaseDate: string | null
  link: string | null
  seller: string | null
  note: string
  isChosen: number     // 1=最终选定
  createTime: string
  updateTime: string
}

export interface PriceItem {
  id: string
  uid: string
  name: string
  category: string | null
  spec: string | null
  note: string
  status: number       // 0=比价中 1=已购买 2=已取消 3=已归档
  chosenEntryId: string | null
  createTime: string
  updateTime: string
  // 附加字段
  entries: PriceEntry[]
  chosenEntry: PriceEntry | null
  entryCount: number
  minPrice: number | null
  maxPrice: number | null
  priceDiff: number | null
}

export interface PriceStatistics {
  totalItems: number
  comparingCount: number
  purchasedCount: number
  cancelledCount: number
  totalEntries: number
  purchasedEntries: number
  totalSpent: number
  totalPotentialSaved: number
  byCategory: { category: string; count: number; totalSpent: number }[]
  cheapestItems: {
    id: string
    name: string
    category: string | null
    minPrice: number
    maxPrice: number
    diff: number
    platformCount: number
  }[]
  recentItems: {
    id: string
    name: string
    category: string | null
    status: number
    statusLabel: string
    updateTime: string
  }[]
}

// 物品状态
export const ITEM_STATUS = {
  COMPARING: 0,
  PURCHASED: 1,
  CANCELLED: 2,
  ARCHIVED: 3
} as const

export const ITEM_STATUS_LABEL: Record<number, string> = {
  0: '比价中',
  1: '已购买',
  2: '已取消',
  3: '已归档'
}

export const ITEM_STATUS_COLOR: Record<number, string> = {
  0: '#409EFF',
  1: '#67C23A',
  2: '#909399',
  3: '#C0C4CC'
}

// 条目状态
export const ENTRY_STATUS = {
  PENDING: 0,
  ORDERED: 1,
  RECEIVED: 2,
  CANCELLED: 3
} as const

export const ENTRY_STATUS_LABEL: Record<number, string> = {
  0: '待定',
  1: '已下单',
  2: '已到货',
  3: '已取消'
}

export const ENTRY_STATUS_COLOR: Record<number, string> = {
  0: '#E6A23C',
  1: '#409EFF',
  2: '#67C23A',
  3: '#909399'
}

// 分类预设
export const CATEGORY_LIST = [
  { value: 'electronics', label: '数码电器', color: '#409EFF', icon: '📱' },
  { value: 'digital', label: '3C 数码', color: '#67C23A', icon: '💻' },
  { value: 'clothing', label: '服饰鞋帽', color: '#E6A23C', icon: '👕' },
  { value: 'food', label: '食品生鲜', color: '#F56C6C', icon: '🍎' },
  { value: 'book', label: '图书音像', color: '#909399', icon: '📚' },
  { value: 'cosmetic', label: '美妆护肤', color: '#C71585', icon: '💄' },
  { value: 'home', label: '家居日用', color: '#FF69B4', icon: '🏠' },
  { value: 'toy', label: '玩具模型', color: '#8A2BE2', icon: '🧸' },
  { value: 'sports', label: '运动户外', color: '#00CED1', icon: '⚽' },
  { value: 'other', label: '其他', color: '#32CD32', icon: '📦' }
] as const

export function getCategoryMeta(value: string | null | undefined) {
  if (!value) return CATEGORY_LIST[CATEGORY_LIST.length - 1]
  return CATEGORY_LIST.find(c => c.value === value) || CATEGORY_LIST[CATEGORY_LIST.length - 1]
}