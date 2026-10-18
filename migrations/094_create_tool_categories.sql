-- 工具分类独立成表：分类可排序、可改名，工具通过 category_id 关联
-- tool_features.category_name 列保留但不再作为名称来源，接口统一 JOIN 本表取名称与排序
--
-- 执行方式（与项目惯例一致）：
--   线上：wrangler d1 execute yifang-tool --file=./migrations/094_create_tool_categories.sql --remote
--   本地：wrangler d1 execute yifang-tool --file=./migrations/094_create_tool_categories.sql --local

CREATE TABLE IF NOT EXISTS tool_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 种子：从 tool_features 现有分类对导入（含本次新增的「编码与加密」）
INSERT INTO tool_categories (id, name, sort_order)
SELECT category_id, category_name,
       ROW_NUMBER() OVER (ORDER BY category_id ASC) * 10
FROM (SELECT DISTINCT category_id, category_name FROM tool_features)
WHERE category_id IS NOT NULL
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  updated_at = datetime('now', 'localtime');

-- 重排分类（幂等，可重复执行）：编码与加密紧随开发运维，其余沿用首页原顺序
UPDATE tool_categories SET sort_order = CASE id
  WHEN 2  THEN 10  -- 开发运维
  WHEN 14 THEN 20  -- 编码与加密
  WHEN 3  THEN 30  -- 文本处理
  WHEN 4  THEN 40  -- 教育学术
  WHEN 5  THEN 50  -- 图片处理
  WHEN 8  THEN 60  -- 数据图表
  WHEN 11 THEN 70  -- 趣味互动
  WHEN 9  THEN 80  -- 选择随机
  WHEN 10 THEN 90  -- AI工具
  WHEN 7  THEN 100 -- 其他工具
  WHEN 12 THEN 110 -- 好物网站
  WHEN 13 THEN 120 -- 内容管理
  ELSE sort_order END;

-- 同步存量工具的 category_name，保证旧代码/旧数据一致
UPDATE tool_features
SET category_name = (SELECT name FROM tool_categories WHERE id = tool_features.category_id)
WHERE category_id IN (SELECT id FROM tool_categories);
