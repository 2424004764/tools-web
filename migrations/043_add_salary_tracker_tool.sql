-- 新增工具 /salary-tracker/（工资变化记录）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：13=内容管理

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('salary-tracker-2026-08-21', '工资变化记录', '/salary-tracker/', 13, '内容管理',
   '追踪每次薪资变动的生效日期、金额与来源，支持涨幅金额/百分比计算、年度对比、里程碑成就与趋势图表',
   '', 139, 1, '2026-08-21 14:00:00', '2026-08-21 14:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;