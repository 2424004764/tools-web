-- 为 user 表添加管理员标识字段
-- is_admin: 0 = 普通用户，1 = 管理员，默认 0
ALTER TABLE user ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

-- 为常用管理后台查询建立索引（按邮箱反查/列表筛选）
CREATE INDEX IF NOT EXISTS idx_user_is_admin ON user(is_admin);