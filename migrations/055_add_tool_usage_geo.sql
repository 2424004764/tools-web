-- 工具使用记录新增地理位置列
-- 数据来源：Cloudflare Pages Functions context.request.cf
--   CF 边缘节点已经识别每个客户端 IP 的归属，免费且准确，无需第三方 API。
-- 准确度参考：
--   - country：99%+（2 字母 ISO 国家代码，如 'CN' / 'US'）
--   - region：通常到省/州（如 'GD' / 'Guangdong'，格式依国家略有差异）
--   - city：主要城市 80-90%（深圳、北京、上海等都能识别到城市级）
--   - 区/县级：CF 不提供，需要 3rd party 库（暂不引入）
--
-- 部署后本地执行：
--   pnpm exec wrangler d1 execute yifang-tool --local --file=migrations/055_add_tool_usage_geo.sql
-- 线上：
--   pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/055_add_tool_usage_geo.sql

ALTER TABLE tool_usage_records ADD COLUMN country TEXT;   -- 2 字母国家代码（ISO 3166-1 alpha-2），如 'CN' / 'US'
ALTER TABLE tool_usage_records ADD COLUMN region TEXT;    -- 省/州（CF 返回值依国家而异：可能是代码也可能是名称）
ALTER TABLE tool_usage_records ADD COLUMN city TEXT;      -- 城市名（英文/原文，如 'Shenzhen'）
ALTER TABLE tool_usage_records ADD COLUMN timezone TEXT; -- IANA 时区，如 'Asia/Shanghai'
ALTER TABLE tool_usage_records ADD COLUMN colo TEXT;     -- Cloudflare 接入点机场代码，如 'HKG' / 'LAX'
