-- 工具可用的 model 列表 + 各自扣费积分
-- 同一 tool_url 下可有多个 model（key 唯一），其中 is_default=1 表示默认选中
-- 解决"按 model 分档扣费"的需求；前端下拉框从这张表拉取
--
-- 关联：
--   028_create_tool_features.sql    工具主表（url 外键语义，不是真外键）
--   033_add_tool_credit_cost.sql    工具维兜底 credit_cost（本表优先级高于它）
--
-- 部署：
--   wrangler d1 execute tools-web-db --file=./functions/db/034_create_tool_models.sql --remote
--
-- 回滚：
--   wrangler d1 execute tools-web-db --command="DROP TABLE tool_models;" --remote

CREATE TABLE tool_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_url TEXT NOT NULL,
  model_key TEXT NOT NULL,        -- 'gpt-image-2-1k'
  model_label TEXT NOT NULL,      -- 'gpt-image-2 1k（标准）'
  description TEXT,
  credit_cost INTEGER NOT NULL DEFAULT 0 CHECK (credit_cost >= 0 AND credit_cost <= 999999),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tool_url, model_key)
);

CREATE INDEX idx_tool_models_tool ON tool_models(tool_url, is_enabled);
CREATE INDEX idx_tool_models_default ON tool_models(tool_url, is_default);
