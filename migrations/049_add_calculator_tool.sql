-- 新增工具 /calculator/（在线计算器：科学计算 + 进制转换）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：4=教育学术

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('calculator-2026-08-23', '在线计算器', '/calculator/', 4, '教育学术',
   '集成科学计算（三角函数、对数、指数、阶乘、幂、常量、度弧度切换、历史记录、记忆）与 2/8/10/16 进制互转，纯前端运算',
   '', 145, 1, '2026-08-23 00:00:00', '2026-08-23 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
