-- Unicode转中文 工具升级：支持三种转义模式与忽略 ASCII 选项，更新标题/描述
-- 工具行已存在（030 种子入库，093 已归入「编码与加密」分类），这里只需 UPDATE
-- 执行方式：wrangler d1 execute yifang-tool --file=./migrations/095_update_unicode_tool.sql --remote

UPDATE tool_features
SET title = 'Unicode转中文',
    description = 'Unicode与中文相互转换，支持 \uXXXX、&#xXXXX;、%uXXXX 三种模式，可忽略 ASCII 字符只编码中文，混合文本只转换转义部分',
    logo = '/images/logo/union.png',
    updated_at = '2026-10-18 00:00:00'
WHERE url = '/unicode/';
