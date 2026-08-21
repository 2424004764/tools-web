-- 新增工具 /height-tracker/（身高记录）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：13=内容管理

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('height-tracker-2026-08-21', '身高记录', '/height-tracker/', 13, '内容管理',
   '家庭成员身高追踪记录，支持趋势图表展示、增长速率分析、目标身高对比与里程碑成就',
   '', 138, 1, '2026-08-21 12:00:00', '2026-08-21 12:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;