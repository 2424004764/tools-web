-- 生成记录表（AI/工具调用日志）
-- 用于记录每个生成请求的：来源工具、模式、模型、状态、扣费、耗时、结果等。
--
-- status 取值：
--   'in_progress' 请求已发起，等待上游响应（两段式日志第一段）
--   'success'     成功
--   'failed'      失败（未扣费，如参数错误）
--   'timeout'     上游超时（未扣费场景下）
--   'reversed'    失败且已自动退还积分
--
-- raw_data (JSON) 存输入参数 + 上下文，方便后续排查/分析：
--   { prompt, size, has_input_image, request_body, upstream_response,
--     client_ip, user_agent }
CREATE TABLE IF NOT EXISTS generation_records (
    id                   TEXT PRIMARY KEY,
    uid                  TEXT,
    source               TEXT NOT NULL,
    mode                 TEXT,
    model                TEXT,
    status               TEXT NOT NULL,
    cost                 INTEGER NOT NULL DEFAULT 0,
    result_url           TEXT,
    error_message        TEXT,
    duration_ms          INTEGER NOT NULL,
    upstream_duration_ms INTEGER,
    upstream_status      INTEGER,
    idempotency_key      TEXT,
    tx_id                TEXT,
    raw_data             TEXT NOT NULL,
    created_at           TEXT NOT NULL
);