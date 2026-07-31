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
  source: 'system' | 'admin' | 'tool' | 'recharge' | null
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

/** 批量调整积分请求体 */
export interface BatchAdjustCreditPayload {
  type: 'grant' | 'deduct'
  amount: number
  reason?: string
  /** 缺省/空数组 = 作用于所有非管理员用户 */
  uids?: string[]
}

/** 批量调整积分返回 */
export interface BatchAdjustCreditResult {
  /** 实际尝试处理的用户数（已自动排除管理员和发起人） */
  total: number
  succeeded: number
  /** 仅 deduct 模式可能出现：用户余额本就是 0，已跳过 */
  skipped: number
  failed: { uid: string; error: string }[]
  /** 实际余额净变动：grant 为正、deduct 为负（部分扣减按实际值计算） */
  total_delta: number
  /** |实际变动| 之和（审计用） */
  balance_change_total: number
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

/** 生成记录（AI 工具调用日志） */
export interface GenerationRecord {
  id: string
  uid: string | null
  user_email?: string | null
  user_name?: string | null
  /** 工具 URL，例如 '/ai-image-edit/' */
  source: string
  /** 子模式，例如 'text-to-image' / 'image-to-image' */
  mode: string | null
  model: string | null
  status: 'in_progress' | 'success' | 'failed' | 'timeout' | 'reversed'
  cost: number
  result_url: string | null
  error_message: string | null
  duration_ms: number
  upstream_duration_ms: number | null
  upstream_status: number | null
  idempotency_key: string | null
  tx_id: string | null
  /** 原始 JSON 字符串 */
  raw_data: string
  /** 后端预解析后的对象（解析失败为 null） */
  raw_data_parsed: Record<string, unknown> | null
  created_at: string
}

/** 兑换码（管理视图） */
export interface RedeemCode {
  id: string
  code: string
  credits: number
  expires_at: string | null
  used_by: string | null
  used_at: string | null
  batch_id: string
  note: string | null
  created_at: string
  created_by: string | null
  /** 兑换人邮箱（LEFT JOIN user 派生） */
  user_email?: string | null
  /** 兑换人昵称 */
  user_name?: string | null
  /** 派生状态：unused / used / expired */
  status: 'unused' | 'used' | 'expired'
}

/** 兑换码批次摘要（管理后台顶部下拉） */
export interface RedeemCodeBatch {
  batch_id: string
  note: string | null
  total: number
  used: number
  created_at: string
}

/** 生成兑换码批次请求体 */
export interface GenerateRedeemCodesPayload {
  /** 每个码可兑换的积分（> 0） */
  credits: number
  /** 生成数量（1-1000） */
  count: number
  /** ISO 时间字符串，可选；空/缺省 = 永不过期 */
  expires_at?: string | null
  /** 批次备注，最多 200 字符 */
  note?: string | null
}

/** 生成兑换码批次返回 */
export interface GenerateRedeemCodesResult {
  batch_id: string
  count: number
  credits: number
  expires_at: string | null
  note: string | null
  codes: string[]
  created_at: string
}