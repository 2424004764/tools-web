-- 新增工具 /code-image/（高亮代码生成图片）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：2=开发运维

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('code-image-2026-08-23', '高亮代码生成图片', '/code-image/', 2, '开发运维',
   '输入代码、选择语言与主题，一键生成带语法高亮的代码截图，支持 190+ 语言与 8 套主题，可调字体、字号、内边距、圆角与水印，纯前端 html2canvas 截图保护隐私',
   '', 146, 1, '2026-08-23 00:00:00', '2026-08-23 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
