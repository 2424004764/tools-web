-- 子站积分消费（OAuth scope: credits）支持
--
-- credit_transactions 增加 OAuth 维度列：
--   client_id  发起消费的 OAuth 应用 id（source='oauth' 时记录，用户流水/后台可按应用筛选对账）
--   order_id   子站业务单号（幂等键：同一应用同一 order_id 的重复 consume 只扣一次，网络重试不会双扣）
--
-- related_tx_id 已存在（退款流水指向原消费流水），无需新增。
--
-- 执行：
--   本地  pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/116_oauth_credits.sql
--   远端  pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/116_oauth_credits.sql

ALTER TABLE credit_transactions ADD COLUMN client_id TEXT;
ALTER TABLE credit_transactions ADD COLUMN order_id TEXT;

-- 幂等唯一索引：仅 OAuth 消费行参与（退款行 order_id 为 NULL，不占唯一性）
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_tx_client_order
  ON credit_transactions(client_id, order_id)
  WHERE client_id IS NOT NULL AND order_id IS NOT NULL;

-- 一笔消费只能退一次：同一 related_tx_id 只允许一条 oauth 退款流水
-- （只约束 oauth 退款行，不影响历史/后台其他用 related_tx_id 的流水）
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_tx_oauth_refund
  ON credit_transactions(related_tx_id)
  WHERE type = 'refund' AND source = 'oauth' AND related_tx_id IS NOT NULL;

-- 按应用维度对账查询
CREATE INDEX IF NOT EXISTS idx_credit_tx_client
  ON credit_transactions(client_id)
  WHERE client_id IS NOT NULL;
