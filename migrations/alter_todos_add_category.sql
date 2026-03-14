-- 为 todos 表添加 category 字段
ALTER TABLE todos ADD COLUMN category TEXT DEFAULT '默认';

-- 创建分类索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_todos_uid_category ON todos(uid, category);
