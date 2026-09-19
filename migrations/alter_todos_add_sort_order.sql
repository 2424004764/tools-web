-- 为 todos 表添加组内排序字段
ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- 分类分组内按顺序查询
CREATE INDEX IF NOT EXISTS idx_todos_uid_category_sort_order
  ON todos(uid, category, sort_order);
