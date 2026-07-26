-- 工具按次扣费积分
-- 默认 0 = 免费（向后兼容，未配置的工具一律不扣费）
-- 0 时 ai-image-edit.js 走原路径（不要求登录、不扣分）
-- 上限 999999 与 admin/users/[uid]/credits.js:47 保持一致；CHECK 兜底
--
-- 关联迁移：
--   028_create_tool_features.sql   表结构
--   030_seed_tool_features.sql     基线数据（无需更新，默认值 0 已生效）
--   031_add_ai_image_edit.sql      AI 图片编辑 seed
--
-- 部署命令（线上）：
--   wrangler d1 execute tools-web-db --file=./functions/db/033_add_tool_credit_cost.sql --remote
-- 本地：
--   wrangler d1 execute tools-web-db --file=./functions/db/033_add_tool_credit_cost.sql
--
-- 回滚（线上）：
--   wrangler d1 execute tools-web-db --command="ALTER TABLE tool_features DROP COLUMN credit_cost;" --remote

ALTER TABLE tool_features ADD COLUMN credit_cost INTEGER NOT NULL DEFAULT 0 CHECK (credit_cost >= 0 AND credit_cost <= 999999);
