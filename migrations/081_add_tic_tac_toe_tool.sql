-- 新增工具 /tic-tac-toe/（井字棋）
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：11=趣味互动（以 030 seed 实际数据为准）

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('140', '井字棋', '/tic-tac-toe/', 11, '趣味互动',
   '经典井字棋圈叉棋，支持人机对战（三档AI难度）和双人同屏对战，先连成三子者获胜',
   '/images/logo/tic_tac_toe.svg', 161, 1, '2026-09-26 00:00:00', '2026-09-26 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
