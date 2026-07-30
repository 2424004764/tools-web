-- 新增 AI 穿搭建议工具
-- id 使用 UUID（与 tool_features 表 TEXT PRIMARY KEY 匹配）
-- 上传人物照（必填）+ 可选上传衣物照：
--   - 不上传衣物照 → AI 自动设计一套完整穿搭（outfit-generate）
--   - 上传衣物照   → 把人物身上衣物替换为上传衣物（outfit-replace）
--
-- 部署（远程 D1）：
--   wrangler d1 execute yifang-tool --remote --file=./functions/db/040_add_ai_outfit.sql
--
-- 本地测试：
--   wrangler d1 execute yifang-tool --local --file=./functions/db/040_add_ai_outfit.sql
--
-- 回滚：
--   wrangler d1 execute yifang-tool --remote --command="DELETE FROM tool_features WHERE url = '/ai-outfit/';"

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('d7354ccf-b8b2-4f9c-856c-4000c8e6959a', 'AI 穿搭建议', '/ai-outfit/', 10, 'AI工具',
   '上传人物照片，可选上传衣物照片，AI 自动设计穿搭或按衣物照替换：保持人物面部、姿态、背景不变', '/images/logo/ai_outfit.svg', 140, 1,
   '2026-07-30 12:00:00', '2026-07-30 12:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
