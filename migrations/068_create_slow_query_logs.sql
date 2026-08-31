-- 慢查询日志表
-- 由 functions/utils/slow-query-log.js 异步写入：
--   所有 D1 prepare 调用在执行后计算耗时，超过阈值（默认 100ms）落一条。
--
-- 拦截范围：
--   1) Model 层（functions/utils/db.js）通过 executeQuery 统一调用，source = 'model'
--   2) raw SQL（services / api / admin）通过包装后的 db.prepare 拦截，source = 'raw'
--
-- 字段语义：
--   sql_text    完整 SQL（包含占位符 ?）
--   params      bind 参数（JSON 数组，最多 50 个，超过截断）
--   operation   SELECT / INSERT / UPDATE / DELETE / OTHER（解析 SQL 首关键字）
--   table_name  SQL 里第一条出现的表名（粗略解析，便于按表聚合慢查询）
--   duration_ms 单次执行耗时（毫秒）
--   path        当前请求路径（来自 context.data，外部注入；raw 层可能为 NULL）
--   method      HTTP 方法
--   uid         已登录用户
--   source      'model' / 'raw'，标记拦截层
--   error       异常信息（若 SQL 抛出也记录，方便定位 N+1 等场景）
--   created_at  UTC 字符串（与项目其他表保持一致）
--
-- 索引：
--   created_at  按时间范围排查
--   table_name  按热点表聚合
--   duration_ms 找最慢的几条
CREATE TABLE IF NOT EXISTS slow_query_logs (
    id          TEXT PRIMARY KEY,
    sql_text    TEXT NOT NULL,
    params      TEXT,
    operation   TEXT,
    table_name  TEXT,
    duration_ms INTEGER NOT NULL,
    path        TEXT,
    method      TEXT,
    uid         TEXT,
    source      TEXT,
    error       TEXT,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slow_query_logs_created_at ON slow_query_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_slow_query_logs_table ON slow_query_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_slow_query_logs_duration ON slow_query_logs(duration_ms);
