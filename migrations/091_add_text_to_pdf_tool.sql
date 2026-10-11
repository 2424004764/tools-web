-- 新增文本转 PDF 工具
-- 数据来源：src/components/Tools/tools.ts

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('141', '文本转 PDF', '/text-to-pdf/', 3, '文本处理',
   '在线将文本内容转换为 A4 PDF，支持中文、自动换行、长文分页及字号和页边距设置，浏览器本地处理',
   '', 33, 1, '2026-10-08 00:00:00', '2026-10-08 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
