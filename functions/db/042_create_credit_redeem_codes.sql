-- 积分兑换码表
-- 管理员生成一批，用户在前台 /me/recharge 输入兑换后获得积分。
--
-- code:           兑换码字符串（去歧义字母表，12 字符，UNIQUE）
-- credits:        本码可兑换的积分数
-- expires_at:     过期时间（NULL = 永不过期）
-- used_by / used_at: 兑换人 UID 与兑换时间；NULL 表示尚未兑换
-- batch_id:       批次 ID（同一批次生成的码共享），用于分组管理与查询
-- note:           批次备注（可选，如「国庆活动」/「手动补发」）
-- created_at:     生成时间
-- created_by:     生成该码的管理员 UID
--
-- 状态由前端按 used_at + expires_at 派生（unused / used / expired），
-- 表内不另存 status 列，避免双源同步问题。

CREATE TABLE credit_redeem_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  credits INTEGER NOT NULL,
  expires_at TEXT,
  used_by TEXT,
  used_at TEXT,
  batch_id TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

-- 按批次查询（管理后台「按批次筛选」）
CREATE INDEX idx_redeem_codes_batch ON credit_redeem_codes(batch_id);

-- 按兑换人查询（管理后台定位某个用户的兑换历史）
CREATE INDEX idx_redeem_codes_used_by ON credit_redeem_codes(used_by);

-- 按创建时间倒序（管理后台默认列表）
CREATE INDEX idx_redeem_codes_created_at ON credit_redeem_codes(created_at DESC);