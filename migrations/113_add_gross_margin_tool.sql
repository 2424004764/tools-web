-- 新增工具 /gross-margin/（毛利率计算器）
-- 数据来源：src/components/Tools/tools.ts（tools.ts 内 id='gross-margin-2026-11-14'，保持一致）
-- category_id 含义：4=教育学术

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('gross-margin-2026-11-14', '毛利率计算器', '/gross-margin/', 4, '教育学术',
   '成本售价实时算毛利率，按目标毛利率反推定价，房租人工等固定费用算盈亏平衡营业额',
   '/images/logo/gross-margin.svg', 204, 1, '2026-11-14 00:00:00', '2026-11-14 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
