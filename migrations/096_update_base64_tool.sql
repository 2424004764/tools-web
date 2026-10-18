-- Base64编码/解码 工具升级：新增字符集选择、过滤非 Base64 字符等能力，更新描述
-- 工具行已存在（030 种子入库，093 已归入「编码与加密」分类），这里只需 UPDATE
-- 执行方式：wrangler d1 execute yifang-tool --file=./migrations/096_update_base64_tool.sql --remote

UPDATE tool_features
SET description = '文本与 Base64 双向转换，支持 UTF/GBK/GB18030/Big5 等字符集，可过滤非 Base64 字符，输入自动编码',
    updated_at = '2026-10-18 00:00:00'
WHERE url = '/base64/';
