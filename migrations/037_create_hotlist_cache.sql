-- 首页热门信息 D1 缓存表
--
-- 用途：聚合首页热门（头条 / B站 / 少数派 / GitHub / HN）。
-- 第三方上游偶发不稳定 + 首页并发高（每个用户首次进入都触发），
-- 在 Worker 内加一层 D1 持久化缓存：
--   - Edge Cache（caches.default，10 min）：抗瞬时并发
--   - 本表（10 min fresh，stale-while-revalidate）：抗上游抖动 + 抗长时间边缘冷启动
--
-- 字段约定：
--   source          数据源 key（与 functions/api/hotlist/[[type]].js 中 SOURCES 一致）
--   data            完整响应 JSON（items[] + title + updateTime 等）
--   fetched_at      上游拉取时间（毫秒时间戳）
--   expires_at      过期时间 = fetched_at + TTL（毫秒时间戳）
--
-- 读取策略（在 Worker 实现）：
--   1. Edge 命中直接返回
--   2. Edge miss → 查本表
--      - 有记录且 expires_at > now：fresh，立即返回；waitUntil 后台刷新
--      - 有记录但 expires_at <= now：stale，立即返回；waitUntil 后台刷新
--      - 无记录：同步拉上游，upsert 后返回
--
-- 写入策略：
--   仅在 fetchSource 成功（items 不为空且无 error）时 upsert；失败不写，避免污染缓存。
--
-- 清理策略：
--   数据量恒定（最多 5 行），无需 cron 清理。过期数据读时判断，写时被覆盖。

CREATE TABLE IF NOT EXISTS hotlist_cache (
    source      TEXT PRIMARY KEY,
    data        TEXT NOT NULL,        -- JSON 字符串
    fetched_at  INTEGER NOT NULL,     -- 毫秒时间戳
    expires_at  INTEGER NOT NULL      -- 毫秒时间戳
);

CREATE INDEX IF NOT EXISTS idx_hotlist_cache_expires_at
    ON hotlist_cache(expires_at);