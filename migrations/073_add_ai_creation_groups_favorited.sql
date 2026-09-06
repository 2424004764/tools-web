-- 073: ai_creation_groups 增加「收藏/星标」字段
-- favorited: 0 = 未收藏（默认），1 = 已收藏
-- 「只看收藏」筛选走 (uid, favorited) 组合条件；现有 idx_aicg_uid_created 已覆盖 uid 前缀，
-- 收藏量通常很小，LIKE/过滤在 uid 结果集上足够快，不额外加索引避免写入放大。

ALTER TABLE ai_creation_groups ADD COLUMN favorited INTEGER NOT NULL DEFAULT 0;
