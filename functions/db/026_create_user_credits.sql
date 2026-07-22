-- 用户积分主表
-- 每个用户一条记录，记录当前余额、累计获得、累计消费、冻结金额
CREATE TABLE user_credits (
  uid TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  frozen INTEGER NOT NULL DEFAULT 0,
  remark TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_user_credits_balance ON user_credits(balance);