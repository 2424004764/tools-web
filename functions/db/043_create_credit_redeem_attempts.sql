-- 兑换码错误尝试计数器
-- 用于防止暴力枚举兑换码：每个用户每个"自然日（北京时）"输错次数累加，达上限后当天不再校验。
--
-- 业务规则：
--   - 按 UID + 北京时日期（YYYY-MM-DD）聚合
--   - 输错达 20 次：当天 0 点前都返回 429，不再校验码
--   - 日期自然翻页：第二天 0 点（北京时）计数器自动重置（新行 wrong_count=0）
--   - 成功兑换不清零（避免引入歧义；计数器仅靠日期滚动清零）
--
-- 列说明：
--   uid:              兑换用户 UID
--   attempt_date:     北京时日期 YYYY-MM-DD
--   wrong_count:      当日累计错误次数
--   first_wrong_at:   当日第一次输错时间
--   last_wrong_at:    当日最近一次输错时间
--   blocked_at:       当日第一次达到 20 次上限的时间（NULL 表示尚未封禁）

CREATE TABLE credit_redeem_attempts (
  uid TEXT NOT NULL,
  attempt_date TEXT NOT NULL,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  first_wrong_at TEXT,
  last_wrong_at TEXT,
  blocked_at TEXT,
  PRIMARY KEY (uid, attempt_date)
);

-- 按 uid 查所有历史（管理员排查用）
CREATE INDEX idx_redeem_attempts_uid ON credit_redeem_attempts(uid);

-- 按日期聚合（管理员看当天全平台被封禁用户数）
CREATE INDEX idx_redeem_attempts_date ON credit_redeem_attempts(attempt_date);

-- 已封禁用户清单（blocked_at IS NOT NULL 的行）
CREATE INDEX idx_redeem_attempts_blocked ON credit_redeem_attempts(attempt_date) WHERE blocked_at IS NOT NULL;