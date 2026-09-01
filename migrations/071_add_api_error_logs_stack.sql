-- 071: 给 api_error_logs 加 error_stack 列，保存服务端异常堆栈
--
-- 背景：业务 catch 里返回 ApiResponse.error('内部服务器错误', ...) 时，
-- _middleware.js 只能从响应体拿到这五个字，看不到真实异常，运维排查只能
-- 登 Cloudflare Workers 控制台翻瞬时日志，太被动。
--
-- 修复思路：
--   1. utils/apiResponse.js 增加一个 INTERNAL_SERVER_ERROR_DETAIL=true 的开关：
--      仅在服务端抛出真异常（且 status=500）时，把 error.message + error.stack
--      写进响应 JSON 的 detail 字段（前端不展示，仅中间件读）
--   2. _middleware.js 解析响应时多读一个 detail，写入 error_message/error_stack
--   3. error_message 列兼容旧值（如 "内部服务器错误"）；error_stack 是新增
--
-- 部署：
--   线上：pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/071_add_api_error_logs_stack.sql
--   本地：pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/071_add_api_error_logs_stack.sql

ALTER TABLE api_error_logs ADD COLUMN error_stack TEXT;   -- 截断至 4000 字符

CREATE INDEX IF NOT EXISTS idx_api_error_logs_created_at
    ON api_error_logs (created_at);