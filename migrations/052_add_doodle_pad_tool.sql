-- 新增工具 /doodle-pad/（在线涂鸦画板）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：5=图片处理

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('doodle-pad-2026-08-23', '在线涂鸦画板', '/doodle-pad/', 5, '图片处理',
   '在线网页涂鸦画板，支持画笔/橡皮切换、10 种预设颜色+拾色器、可调画笔粗细与橡皮大小、撤销/重做、画布尺寸与背景色可设置、一键下载 PNG 或复制到剪贴板，纯前端 HTML5 Canvas',
   '', 147, 1, '2026-08-23 00:00:00', '2026-08-23 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;