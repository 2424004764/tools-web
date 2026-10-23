-- 网站访问记录表（站点级 PV）
-- 记录任意页面（首页 / 工具页 / 博客 / 活动页等）的每次进入，用于：
--   - 后台仪表盘「网站访问次数」卡片：今日 / 本周 / 本月 / 累计 + 日/周/月趋势
--   - 页面 TOP 榜（按 path 聚合），辅助了解哪些页面最常被使用
--
-- 与 tool_usage_records 的区别：
--   - tool_usage_records 只记"已注册工具页面"且前端 30 秒去重，是业务语义的"使用"
--   - 本表是站点级 PV：路由 afterEach 每次成功导航都记一条（重复刷新也算），
--     不做任何去重，用于观测全站真实访问量
--
-- 字段与 tool_usage_records 对齐（uid/ip/geo/source），便于复用同一套分析口径：
--   - uid：登录用户 id；未登录为 ''（统计全量访问）
--   - source：推广来源（utm_source 优先 → referer 指纹 → 'direct'）

CREATE TABLE IF NOT EXISTS site_visits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    uid        TEXT    NOT NULL DEFAULT '',
    path       TEXT    NOT NULL,    -- 页面 SPA 路由，如 '/' / '/img-puzzle/' / '/blog/123'
    visited_at INTEGER NOT NULL,    -- 秒级时间戳（前端 Date.now()/1000）
    ip         TEXT,
    country    TEXT,
    region     TEXT,
    city       TEXT,
    timezone   TEXT,
    colo       TEXT,
    source     TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_visits_visited_at ON site_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_path ON site_visits(path);
