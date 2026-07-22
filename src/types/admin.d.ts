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
  type: 'grant' | 'deduct' | 'reset' | 'reverse'
  amount: number
  balance_after: number
  reason: string | null
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