-- 工具使用记录新增 IP 列
-- 背景：原来匿名用户（uid = ''）无法区分。给 tool_usage_records 加 ip 列，
--   所有记录都带 IP（登录用户也存，便于后台审计和异常访问溯源）。
-- IP 来源：CF-Connecting-IP（Cloudflare Pages 透传的真实客户端 IP），
--   与 functions/_middleware.js 与 functions/utils/error-log.js 一致。
--
-- 注意：
--   - TEXT 类型：兼容 IPv4 / IPv6（IPv6 最长 45 字符）
--   - 不加 NOT NULL：旧记录（迁移前写入）保持 ip = NULL
--   - 不加索引：明细表写多读少（admin 列表按时间排序已够用），暂不引入额外写入开销

ALTER TABLE tool_usage_records ADD COLUMN ip TEXT;