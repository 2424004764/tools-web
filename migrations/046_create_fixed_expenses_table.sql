-- 每月固定开销工具（单用户、无成员维度）
-- 字段：
--   name          : 开销项目名称（如"房租"、"网费"、"健身卡"）
--   amount        : 每月金额（元）
--   category      : 分类（housing/subscription/insurance/transport/loan/education/other 等，前端预设 + 自由输入）
--   billing_day   : 每月扣款日（1-31，可选）
--   start_date    : 启用日期（默认今日）
--   end_date      : 结束日期（可选，到期类如 12 期分期）
--   note          : 备注
--   is_active     : 1 启用 / 0 停用

CREATE TABLE IF NOT EXISTS fixed_expenses (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT,
  billing_day INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  note TEXT,
  is_active INTEGER DEFAULT 1,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_uid ON fixed_expenses(uid);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_uid_active ON fixed_expenses(uid, is_active);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_billing_day ON fixed_expenses(billing_day);
