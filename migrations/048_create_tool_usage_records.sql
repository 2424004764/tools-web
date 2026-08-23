-- 工具使用记录表
-- 记录登录用户进入工具页面的行为，用于：
--   - 首页「最近使用」横滑条（用户端 GET /api/me/tool-usage/recent）
--   - 后台「工具使用记录」明细与聚合统计（GET /api/admin/tool-usage[/stats]）
--   - 仪表盘「今日/本周工具使用次数」+ TOP 工具卡片
--
-- 与 generation_records 的区别：
--   generation_records 是 AI 工具调用流水（含 result_url / duration_ms / cost 等），
--   本表颗粒度更轻：每次进入工具页面 = 1 条，仅记 uid + 工具 + 时间。
--
-- 去重策略：前端 30 秒内同工具不重复打点（sessionStorage），后端不去重，
--   这样后台能看到真实进入次数（含刷新）。

CREATE TABLE IF NOT EXISTS tool_usage_records (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    uid        TEXT    NOT NULL,
    tool_url   TEXT    NOT NULL,    -- 工具 SPA 路由，如 '/img-puzzle/'
    tool_title TEXT    NOT NULL,    -- 冗余：工具改名/下架后仍可还原语义
    used_at    INTEGER NOT NULL     -- 秒级时间戳（前端 Date.now()/1000）
);
