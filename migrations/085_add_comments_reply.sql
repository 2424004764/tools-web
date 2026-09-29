-- 085: 评论回复功能
-- 后台可对评论进行回复（站长回复）：回复行挂在 parent_id 下、is_admin = 1、
-- 状态直接为 approved；若被回复的评论还在待审，则同时自动改为 approved。
-- 线上：pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/085_add_comments_reply.sql
-- 本地：pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/085_add_comments_reply.sql

ALTER TABLE comments ADD COLUMN parent_id TEXT;
ALTER TABLE comments ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);
