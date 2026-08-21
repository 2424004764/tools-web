-- 新增工具 /fixed-expenses/（每月固定开销）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：13=内容管理

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('fixed-expenses-2026-08-21', '每月固定开销', '/fixed-expenses/', 13, '内容管理',
   '记录每月固定的开销项目（房租、订阅、贷款、保险等），自动按月汇总，分类可视化，按扣款日提醒，帮助你清晰掌控每月刚性支出',
   '', 140, 1, '2026-08-21 15:00:00', '2026-08-21 15:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
