-- 流水来源：区分系统自动化 / 管理员手工 / 工具扣费
-- source: system(系统自动) | admin(管理员手工) | tool(工具调用)
-- 历史数据：不做回填，保留 NULL（前端展示为"未知"）
-- 应用层在所有 INSERT 处显式赋值；D1 无枚举，依靠代码约束
-- 写入约定：
--   - 新 grant/deduct from admin/credits.js → 'admin'
--   - 新 deduct from ai-image-edit.js    → 'tool'
--   - 新 reverse from ai-image-edit.js   → 'tool'（hard-coded，永远反转自己的 tool deduct）
--   - 未来 reset 写入                    → 'system'
--
-- 部署：
--   wrangler d1 execute yifang-tool --file=./functions/db/038_add_source_column.sql --remote
--
-- 回滚：
--   wrangler d1 execute yifang-tool --command="ALTER TABLE credit_transactions DROP COLUMN source;" --remote

ALTER TABLE credit_transactions ADD COLUMN source TEXT;