-- 新增工具 /chmod/（Chmod权限计算器）
-- 数据来源：src/components/Tools/tools.ts（tools.ts 内 id=161 已被 tool_features 的字符集工具占用，改用字符串 id）
-- category_id 含义：2=开发运维

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('chmod-2026-11-06', 'Chmod权限计算器', '/chmod/', 2, '开发运维',
   'Linux 文件权限计算器，勾选读/写/执行实时生成八进制与符号表示，支持特殊权限位与常用预设',
   '/images/logo/keywords.png', 201, 1, '2026-11-06 00:00:00', '2026-11-06 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
