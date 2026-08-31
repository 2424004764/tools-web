-- 新增工具 /my-ai-creations/（我的 AI 创作，登录用户私有）
-- 数据来源：src/components/Tools/tools.ts
-- 沿用 031_add_ai_media_works.sql 的写法：增量 INSERT，让已执行过 030 seed 的本地环境继续累积新工具，无需重跑全量。
-- ON CONFLICT(url) 保证重复执行也是幂等的（更新标题/描述/排序）。

-- category_id 含义（与 src/components/Tools/tools.ts 中的 cateId 严格一致）：
--   2=开发运维, 3=文本处理, 4=教育学术, 5=图片处理, 6=趣味互动, 7=其他工具,
--   8=数据图表, 9=选择随机, 10=AI工具, 12=其他工具

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('my-ai-creations-2026-08-31', '我的 AI 创作', '/my-ai-creations/', 10, 'AI工具',
   '查看当前登录用户在 AI 工具中生成的私有图片素材，按提示词任务分组浏览',
   '/images/logo/ai_tools.png', 131, 1, '2026-08-31 22:00:00', '2026-08-31 22:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;