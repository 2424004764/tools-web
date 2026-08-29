-- 用户工具收藏表
--
-- 用途：首页工具卡片 / 工具详情页 header 的收藏功能。
-- tool_url 与 tools.ts 中各工具的 url 对齐（保留首尾斜杠，如 '/ai-image-edit/'），
-- 工具是前端静态清单（tools.ts），不入库，所以只存 url，标题/logo 由前端投影。
-- 用户级：每个登录用户各自一份，互不可见。
--
-- 应用方式（本地 / 远端 D1）：
--   wrangler d1 execute yifang-tool --local  --file=migrations/066_create_user_favorite_tools.sql
--   wrangler d1 execute yifang-tool --remote --file=migrations/066_create_user_favorite_tools.sql

CREATE TABLE IF NOT EXISTS user_favorite_tools (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    uid         TEXT NOT NULL,              -- 用户 ID（与 user_favorite_apps.uid 同源）
    tool_url    TEXT NOT NULL,              -- 工具路径，对齐 tools.ts 的 url 字段
    create_time TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(uid, tool_url)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_tools_uid_time
    ON user_favorite_tools(uid, create_time DESC);
