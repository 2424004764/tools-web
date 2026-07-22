-- 积分流水表
-- 每次积分变动（赠送/扣减/重置/撤销）记录一条流水
-- type: grant(赠送) | deduct(扣减) | reset(重置) | reverse(撤销)
-- amount: 正数=增加，负数=减少
-- balance_after: 变动后的余额，用于审计追溯
-- related_tx_id: 撤销时关联原流水 ID
CREATE TABLE credit_transactions (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT,
  operator_uid TEXT NOT NULL,
  related_tx_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_credit_tx_uid_created ON credit_transactions(uid, created_at DESC);
CREATE INDEX idx_credit_tx_operator ON credit_transactions(operator_uid, created_at DESC);
CREATE INDEX idx_credit_tx_created ON credit_transactions(created_at DESC);