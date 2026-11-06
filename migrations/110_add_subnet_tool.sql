-- 新增工具 /subnet/（子网掩码/IP计算器）
-- 数据来源：src/components/Tools/tools.ts（tools.ts 内 id=163，沿用字符串 id 避免库内数字 id 复用冲突）
-- category_id 含义：2=开发运维

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('subnet-2026-11-06', '子网掩码/IP计算器', '/subnet/', 2, '开发运维',
   '输入 IP 与掩码（支持 CIDR/点分掩码），实时计算网络地址、广播地址、可用主机范围、反掩码，附 CIDR 对照表',
   '/images/logo/subnet.png', 203, 1, '2026-11-06 00:00:00', '2026-11-06 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
