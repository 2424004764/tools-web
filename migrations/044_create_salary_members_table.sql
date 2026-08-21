-- 工资记录工具：成员表
-- 字段对齐 height_members / weight_members，便于组件复用
-- 工资场景没有 birth_date / sex / goal_height 等概念

CREATE TABLE IF NOT EXISTS salary_members (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_color TEXT,
  avatar_emoji TEXT,
  is_default INTEGER DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_salary_members_uid ON salary_members(uid);
