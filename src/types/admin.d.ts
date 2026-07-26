// 后台管理相关 TS 类型

/** 后台分页 */
export interface AdminPagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/** 用户（管理视图） */
export interface AdminUser {
  id: string
  email: string | null
  username: string | null
  avatar: string | null
  is_admin: number
  is_disabled: number
  disabled_reason: string | null
  disabled_at: string | null
  created_at: string
  last_login: string | null
  credits_balance?: number
  credits_earned?: number
  credits_spent?: number
}

/** 用户详情（含积分） */
export interface AdminUserDetail {
  user: AdminUser
  credits: AdminUserCredits
  recentTransactions: CreditTransaction[]
}

/** 积分主表 */
export interface AdminUserCredits {
  balance: number
  total_earned: number
  total_spent: number
  frozen: number
  remark: string | null
  created_at: string | null
  updated_at: string | null
}

/** 积分流水 */
export interface CreditTransaction {
  id: string
  uid: string
  type: 'grant' | 'deduct' | 'reverse'
  amount: number
  balance_after: number
  reason: string | null
  /** 流水来源：迁移前的老数据为 null（前端展示为"未知"） */
  source: 'system' | 'admin' | 'tool' | null
  operator_uid: string
  operator_email?: string
  operator_name?: string | null
  user_email?: string
  user_name?: string | null
  related_tx_id?: string | null
  created_at: string
}

/** 工具功能 */
export interface ToolFeature {
  id: string
  title: string
  url: string
  category_id: number
  category_name: string
  description: string | null
  logo: string | null
  sort_order: number
  is_enabled: number
  /** 每次使用消耗的积分；0 = 免费（model 维度未配置时的兜底） */
  credit_cost: number
  created_at: string
  updated_at: string
}

/** 工具可用的 model（按 model 维度扣费时用） */
export interface ToolModel {
  id: number
  tool_url: string
  model_key: string
  model_label: string
  description: string | null
  credit_cost: number
  sort_order: number
  is_enabled: number
  is_default: number
  created_at: string
  updated_at: string
}

/** 分类聚合 */
export interface ToolCategorySummary {
  category_id: number
  category_name: string
  total: number
  enabled: number
}

/** 仪表盘统计 */
export interface AdminDashboard {
  totalUsers: number
  todayNew: number
  disabledUsers: number
  totalBalance: number
  totalEarned: number
  creditUsers: number
  recentTransactions: CreditTransaction[]
  tools: { total: number; enabled: number }
}