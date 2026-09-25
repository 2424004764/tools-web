-- 081: ai_creation_groups 增加「标签」字段
-- tags: 逗号分隔的标签文本，如 '风景,头像,宫崎骏'；空串 = 未打标签（默认，符合需求「默认空」）。
-- AI 生成与手动上传的合集都走这一列；精确筛选用 (',' || tags || ',') LIKE '%,tag,%'，
-- 收藏量级经验：单 uid 合集数有限，uid 前缀索引 idx_aicg_uid_created 已覆盖，不额外加索引。

ALTER TABLE ai_creation_groups ADD COLUMN tags TEXT NOT NULL DEFAULT '';
