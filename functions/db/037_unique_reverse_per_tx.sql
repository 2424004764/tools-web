-- reverse 去重：同一 related_tx_id 只能有一条 reverse 流水
-- 修复场景：上游 4xx + fetch 同时抛错时，catch 块逻辑交叉可能重复 reverse
--
-- 部署：
--   wrangler d1 execute tools-web-db --file=./functions/db/037_unique_reverse_per_tx.sql --remote
--
-- 回滚：
--   wrangler d1 execute tools-web-db --command="DROP INDEX idx_credit_tx_unique_reverse;" --remote

CREATE UNIQUE INDEX idx_credit_tx_unique_reverse
  ON credit_transactions(related_tx_id)
  WHERE type = 'reverse' AND related_tx_id IS NOT NULL;
