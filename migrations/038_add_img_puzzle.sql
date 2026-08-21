-- 新增工具 /img-puzzle/（图片拼图）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：
--   5=图片处理

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('img-puzzle-2026-08-19', '图片拼图', '/img-puzzle/', 5, '图片处理',
   '支持宫格、长条、阶梯、电影海报、大图居中、心形/圆形等多种模板，一键合成多图排版',
   '', 136, 1, '2026-08-19 10:00:00', '2026-08-19 10:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;