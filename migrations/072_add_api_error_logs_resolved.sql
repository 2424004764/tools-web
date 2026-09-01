-- 072: 给 api_error_logs 加「是否已处理」三件套
--
-- 运维排障流程：
--   1. 错误日志页看到新记录 → 点详情看 error_stack 定位根因
--   2. 在代码里改完部署后 → 标记这条已处理（is_resolved=1），避免下次误以为是新故障
--   3. 30 天清理时只清已处理过的（也可保留 is_resolved=1 的，按业务自定）
--
-- 字段：
--   is_resolved    0=未处理（默认），1=已处理
--   resolved_at    标记时间，NULL=未处理
--   resolved_by    标记人 UID（取自当前会话），NULL=未处理
--   resolved_note  备注（最多 200 字，可选；如 "已修复上线，commit abc123"）
--
-- 索引：未处理是高频查询场景（运维每天进后台先看未处理），加 is_resolved + created_at 复合索引
--
-- 部署：
--   线上：pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/072_add_api_error_logs_resolved.sql
--   本地：pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/072_add_api_error_logs_resolved.sql

ALTER TABLE api_error_logs ADD COLUMN is_resolved  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE api_error_logs ADD COLUMN resolved_at  TEXT;
ALTER TABLE api_error_logs ADD COLUMN resolved_by  TEXT;
ALTER TABLE api_error_logs ADD COLUMN resolved_note TEXT;

-- 加快「未处理 + 按时间倒序」的列表查询（最常用的运维视图）
CREATE INDEX IF NOT EXISTS idx_api_error_logs_resolved_created
    ON api_error_logs (is_resolved, created_at DESC);