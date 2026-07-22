-- 工具功能开关表
-- 把 tools.ts 中硬编码的 100+ 工具迁入数据库，支持运行时启用/禁用
-- is_enabled: 0=禁用(前台不展示), 1=启用(默认)
-- 数据由 030_seed_tool_features.sql 初始化
CREATE TABLE tool_features (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category_id INTEGER NOT NULL,
  category_name TEXT NOT NULL,
  description TEXT,
  logo TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_tool_features_enabled ON tool_features(is_enabled);
CREATE INDEX idx_tool_features_category ON tool_features(category_id);
CREATE INDEX idx_tool_features_sort ON tool_features(category_id, sort_order);