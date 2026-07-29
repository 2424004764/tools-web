-- 新增工具 /ai-media-works/（AI 媒体作品画廊）
-- 数据来源：src/components/Tools/tools.ts
-- 之所以单独 migration 而不是重新生成 030_seed_tool_features.sql：
--   030 是 scripts 自动生成的全量 seed（每次 tools.ts 变更时整体覆盖）；
--   此处增量 INSERT 是为了让本地已执行过 030 的环境继续累积新工具，无需重跑全量。

-- category_id 含义（与 src/components/Tools/tools.ts 中的 cateId 严格一致）：
--   2=开发运维, 3=文本处理, 4=教育学术, 5=图片处理, 6=趣味互动, 7=其他工具,
--   8=数据图表, 9=选择随机, 10=AI工具, 12=其他工具

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('ai-media-works-2026-07-29', 'AI 媒体作品', '/ai-media-works/', 10, 'AI工具',
   '汇集免费 AI 模型（Agnes 等）自动生成的图片与视频画廊，每天定时更新，可按分类与类型筛选浏览',
   '/images/logo/ai_tools.png', 130, 1, '2026-07-29 14:30:00', '2026-07-29 14:30:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
