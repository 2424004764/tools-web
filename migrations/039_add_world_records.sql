-- 新增工具 /world-records/（世界之最）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：
--   4=教育学术

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('world-records-2026-08-21', '世界之最', '/world-records/', 4, '教育学术',
   '收录自然地理、国家、建筑、动物、植物、人体、科技、文化八大类世界纪录数据，支持关键词搜索与分类筛选',
   '', 137, 1, '2026-08-21 10:00:00', '2026-08-21 10:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;