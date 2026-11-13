-- 112: tool_models 允许同 tool_url 下重复 model_key
--
-- 背景：同一模型需要配置多个变体（如 gpt-image-2.6-sunburst 的静图 / 动图两行，
-- 各自独立的显示名称、上游链 extra_body、积分），UNIQUE(tool_url, model_key) 挡住了新增。
-- SQLite 不支持 DROP CONSTRAINT，只能重建表去掉唯一约束；行 id 全量保留，
-- 前端下拉与生成端点（ai-image-edit / ai-outfit）按行 id 精确命中变体，存量数据不受影响。
-- 原 UNIQUE 隐含的 (tool_url, model_key) 查询能力改由普通索引提供。

DROP TABLE IF EXISTS tool_models_migrate;

CREATE TABLE tool_models_migrate (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_url TEXT NOT NULL,
  model_key TEXT NOT NULL,
  model_label TEXT NOT NULL,
  description TEXT,
  credit_cost INTEGER NOT NULL DEFAULT 0 CHECK (credit_cost >= 0 AND credit_cost <= 999999),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  upstreams TEXT
);

INSERT INTO tool_models_migrate
  (id, tool_url, model_key, model_label, description, credit_cost, sort_order,
   is_enabled, is_default, created_at, updated_at, upstreams)
SELECT id, tool_url, model_key, model_label, description, credit_cost, sort_order,
       is_enabled, is_default, created_at, updated_at, upstreams
FROM tool_models;

DROP TABLE tool_models;
ALTER TABLE tool_models_migrate RENAME TO tool_models;

CREATE INDEX IF NOT EXISTS idx_tool_models_tool_key ON tool_models(tool_url, model_key);
