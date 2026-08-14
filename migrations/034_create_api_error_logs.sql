-- API 错误日志表（全局失败请求日志）
--
-- 由 functions/_middleware.js 统一捕获：凡 /api/* 且响应状态码 >= 400 的请求都会落一条。
-- 目的是让线上排障靠查表，而不是靠 wrangler tail 抓瞬时日志。
--
-- error_stage 取值（业务代码可通过 attachUpstreamError 显式标注，未标注时为 unknown）：
--   'validation' 入参校验失败（邮箱格式、类型参数等）
--   'auth'       鉴权/权限失败
--   'db'         D1 查询失败
--   'kv'         KV 绑定缺失或读写失败
--   'upstream'   第三方服务失败（Resend、AI 供应商等）
--   'unknown'    未分类
--
-- upstream_* 三列用于记录第三方服务的真实响应，这是中间件本身看不到、
-- 必须由业务代码主动挂上来的信息（例如 Resend 返回的 401 + 错误体）。
--
-- extra (JSON) 存附加上下文，例如 { email, type } 等便于复现的参数。
--   注意：不要往里写密钥、密码、完整 token 等敏感信息。
CREATE TABLE IF NOT EXISTS api_error_logs (
    id              TEXT PRIMARY KEY,
    path            TEXT NOT NULL,      -- 如 /api/send-verification-code
    method          TEXT NOT NULL,
    status          INTEGER NOT NULL,   -- 返回给客户端的 HTTP 状态码
    error_message   TEXT,               -- 响应体里的 error 字段
    error_stage     TEXT,               -- 失败环节，见上方说明
    upstream_name   TEXT,               -- 如 resend / openai
    upstream_status INTEGER,            -- 上游返回的状态码，如 401
    upstream_body   TEXT,               -- 上游响应体（截断至 2000 字符）
    uid             TEXT,               -- 已登录用户 ID，未登录为 NULL
    client_ip       TEXT,
    user_agent      TEXT,
    duration_ms     INTEGER,
    extra           TEXT,               -- JSON 附加上下文
    created_at      TEXT NOT NULL       -- ISO 8601
);
