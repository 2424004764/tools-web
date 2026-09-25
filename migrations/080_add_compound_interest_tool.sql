-- 新增工具 /compound-interest/（复利计算器）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：4=教育学术

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('139', '复利计算器', '/compound-interest/', 4, '教育学术',
   '本金、年利率、年限与定投实时计算复利终值，对照单利、倒推本金/年限/利率，附年度明细与增长曲线',
   '/images/logo/compound-interest.svg', 160, 1, '2026-09-24 00:00:00', '2026-09-24 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
