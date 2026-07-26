-- 补全 030_seed_tool_features.sql 漏掉的三个工具
-- 这三个工具已在 src/components/Tools/tools.ts 与 src/router/router.ts 中实现并上线，
-- 但因 030 是按 tools.ts 自动生成的快照，后来追加的三个新工具在 tools.ts 里复用了
-- 已有 id（130/131/135），导致自动同步器没把它们识别为新条目，没进 seed。
--
-- 为避免与已有数字 id 冲突，本迁移用 UUID v4 作为 id。
-- 关联迁移：028_create_tool_features.sql（表结构）、030_seed_tool_features.sql（基线）
--
-- 部署命令（线上）：
--   wrangler d1 execute tools-web-db --file=./functions/db/032_add_missing_tools.sql --remote
--
-- 本地开发：
--   wrangler d1 execute tools-web-db --file=./functions/db/032_add_missing_tools.sql

INSERT INTO tool_features (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at) VALUES
('134ca9be-0012-47e5-a1cc-dc95c33fa30d', '退休倒计时', '/retirement-countdown/', 11, '趣味互动', '根据出生年月、工作开始时间、性别与目标退休年龄，实时倒计时距离退休还有多少天，含工龄格子图', '/images/logo/retirement-countdown.png', 135, 1, '2026-07-24 00:00:00', '2026-07-24 00:00:00'),
('84dca247-5da5-409e-8496-61f486229c23', '辈分称谓计算', '/generation-calculator/', 11, '趣味互动', '以「我」为根的交互式家谱树，点击节点长出父母/兄弟/子女等分支，自动推导亲戚称谓、辈分高低与反向称呼，支持堂表、父系母系与姻亲', '/images/logo/generation-calculator.png', 136, 1, '2026-07-24 00:00:00', '2026-07-24 00:00:00'),
('d7ecff79-9131-4c6c-a3c7-8fde2deefad4', '24 点（算 24）', '/make24/', 11, '趣味互动', '经典 24 点数学游戏，随机发 4 张牌，用 +、-、×、÷ 和括号算出 24，多档难度、连击与提示', '/images/logo/make24.png', 137, 1, '2026-07-24 00:00:00', '2026-07-24 00:00:00');
