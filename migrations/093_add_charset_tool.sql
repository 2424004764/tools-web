-- 新增字符编码/解码工具（纯前端实现，基于 iconv-lite），并新增「编码与加密」分类
-- 将 URL编码/解码、Unicode转中文、Base64编码/解码、文本加密/解密 一并归入新分类
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：14=编码与加密（新增分类）

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('161', '字符编码/解码', '/charset/', 14, '编码与加密',
   '字符与字节序列互转，支持 UTF-8/16/32、GBK、GB18030、Big5 等字符集与十六进制/十进制格式，输入自动编码，支持自定义分隔符',
   '/images/logo/union.png', 181, 1, '2026-10-17 00:00:00', '2026-10-17 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;

-- 以下四个工具仅调整分类归属，不改动标题/描述/排序等已有字段
UPDATE tool_features SET category_id = 14, category_name = '编码与加密', updated_at = '2026-10-17 00:00:00'
WHERE url IN ('/urlencode/', '/unicode/', '/base64/', '/text-crypto/');
