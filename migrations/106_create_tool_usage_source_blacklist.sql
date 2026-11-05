-- 工具使用记录「来源黑名单」：后台手动圈禁垃圾来源（漏扫 payload / 恶意 utm_source）
-- 背景：漏洞扫描器会把 SQL 注入 / XSS 探测 payload 塞进页面所有 URL 参数（含 utm_source），
--   无头浏览器执行 JS 后埋点上报成功，payload 就成了「推广来源」污染统计。
--   不做白名单/长度拦截（会误杀真实自定义渠道），改为管理员手动批量拉黑：
--   拉黑仅影响 admin 统计与明细查询（过滤展示），记录本身保留入库，可随时解禁恢复。
--
-- 生效位置：
--   - functions/api/admin/tool-usage/stats.js    全部聚合剔除黑名单来源，返回 blockedCount
--   - functions/api/admin/tool-usage.js          明细列表默认剔除
--   - functions/api/admin/tool-usage/source-blacklist.js  黑名单管理（GET/POST/DELETE）
--
-- 部署后本地执行：
--   pnpm exec wrangler d1 execute yifang-tool --local --file=migrations/106_create_tool_usage_source_blacklist.sql
-- 线上：
--   pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/106_create_tool_usage_source_blacklist.sql

CREATE TABLE IF NOT EXISTS tool_usage_source_blacklist (
  source TEXT PRIMARY KEY,               -- 来源标识（与 tool_usage_records.source 同口径：小写 [a-z0-9_-] ≤64）
  reason TEXT NOT NULL DEFAULT '',       -- 拉黑原因（选填，展示用）
  created_by TEXT,                       -- 管理员 uid
  created_by_email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))   -- UTC 'YYYY-MM-DD HH:MM:SS'
);
