-- 新增 SVG转JPG/PNG 工具（纯前端 Canvas 实现，无后端接口）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：5=图片处理

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('168', 'SVG转JPG/PNG', '/svg-to-image/', 5, '图片处理',
   '上传SVG文件或粘贴SVG代码，转换为JPG、PNG位图，支持0.5~4倍缩放、自定义宽度、透明背景与质量调节',
   '', 182, 1, '2026-10-26 00:00:00', '2026-10-26 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
