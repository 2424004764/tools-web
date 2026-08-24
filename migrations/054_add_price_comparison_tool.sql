-- 新增工具 /price-comparison/（物品比价）
- 数据来源：src/components/Tools/tools.ts
- category_id 含义：13=内容管理

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('price-comparison-2026-08-24', '物品比价', '/price-comparison/', 13, '内容管理',
   '记录同一商品在淘宝、京东、拼多多、1688、官网、线下等不同平台的售价与最终实付价，自动计算运费/优惠/最终价、找出最低价、标记最终购买平台与备注，支持统计节省金额与已购买商品',
   '', 145, 1, '2026-08-24 10:00:00', '2026-08-24 10:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;