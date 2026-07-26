-- 幂等键：前端每次请求带唯一 key，后端查同 key 已有结果直接复用
-- 解决两个问题：
--   1) 上游成功但客户端断开 → 用户重试 → 重复扣费
--   2) 同 key 重发 → 重复触发上游任务
--
-- UNIQUE INDEX 仅对非空 key 生效（兼容老的扣费记录）
--
-- 部署：
--   wrangler d1 execute tools-web-db --file=./functions/db/036_add_idempotency_key.sql --remote
--
-- 回滚：
--   wrangler d1 execute tools-web-db --command="DROP INDEX idx_credit_tx_idempotency; ALTER TABLE credit_transactions DROP COLUMN idempotency_key;" --remote

ALTER TABLE credit_transactions ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX idx_credit_tx_idempotency
  ON credit_transactions(uid, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
