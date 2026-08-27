-- API 错误日志新增地理位置列
-- 数据来源：Cloudflare Pages Functions context.request.cf
- 与 migrations/055_add_tool_usage_geo.sql 同源字段命名与含义，方便联表排查。
--
-- 设计取舍：
--   1. 不加索引：错误日志是写多读少的 append-only 表，按 created_at 排序查询已够用；
--      加索引会增加 INSERT 写开销，且错误日志整体规模可控（清理 30 天前）。
--   2. country / city 允许 NULL：旧记录（迁移前）以及本地 dev 环境无 CF context 时都是 NULL。
--   3. region / timezone / colo 同步加：与 tool_usage_records 字段对齐，方便联表做「同一 IP
--      在 /api/* 失败 + 在工具页被使用」的关联分析。
--
-- 部署：
--   线上：pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/064_add_api_error_logs_geo.sql
--   本地：pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/064_add_api_error_logs_geo.sql

ALTER TABLE api_error_logs ADD COLUMN country TEXT;   -- ISO 3166-1 alpha-2，如 'CN' / 'US'
ALTER TABLE api_error_logs ADD COLUMN region TEXT;    -- 省/州（CF 返回值依国家而异）
ALTER TABLE api_error_logs ADD COLUMN city TEXT;      -- 城市英文/原文
ALTER TABLE api_error_logs ADD COLUMN timezone TEXT; -- IANA 时区，如 'Asia/Shanghai'
ALTER TABLE api_error_logs ADD COLUMN colo TEXT;     -- CF 接入点机场代码，如 'HKG'