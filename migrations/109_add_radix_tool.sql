-- 新增工具 /radix/（数字进制转换）
-- 数据来源：src/components/Tools/tools.ts（tools.ts 内 id=162 为数字 id，库内数字 id 存在复用，改用字符串 id）
-- category_id 含义：2=开发运维

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('radix-2026-11-06', '数字进制转换', '/radix/', 2, '开发运维',
   '2-36 进制互转，实时转换二进制、八进制、十进制、十六进制，支持小数、负数与任意精度大数',
   '/images/logo/Time.png', 202, 1, '2026-11-06 00:00:00', '2026-11-06 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
