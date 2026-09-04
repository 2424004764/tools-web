-- AI 创作图「认领」记录表
-- 用户声明某张 AI 生成图已发布到某个平台（小红书/微博/公众号/视频号 + 自定义）。
-- 数据全部按 uid 隔离，私有记录。
--
-- 部署：
--   wrangler d1 execute yifang-tool --file=./functions/db/046_ai_creation_claims.sql --remote
--
-- 表结构：
--   - id: 自增主键
--   - uid: 用户 id（与 ai_creation_images.uid 一致），用于跨表过滤
--   - image_id: 关联 ai_creation_images.id，不加外键（用户要求删图时直接 DELETE FROM 此表清理）
--   - platform: 平台名（小红书/微博/公众号/视频号/用户自定义字符串），去前后空格
--   - created_at: 认领时间
--
-- 索引：
--   - (uid, image_id): 「拉取某张图的所有认领」最常用
--   - (image_id): 「删图时清理认领」专用
--   - (uid, platform, image_id) UNIQUE: 同一图同一平台只能认领一次（重复插入由 UPSERT 兜底）
--
-- 不设外键：用户明确要求「图删了直接删认领表记录」，走应用层 SQL 清理，不用 DB 级 cascade。

CREATE TABLE IF NOT EXISTS ai_creation_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  image_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- 平台名最多 30 字：4 个预设都在 4 字内 + 自定义也预留够用
  CONSTRAINT platform_length CHECK (length(platform) > 0 AND length(platform) <= 30)
);

CREATE INDEX IF NOT EXISTS idx_ai_creation_claims_uid_image
  ON ai_creation_claims (uid, image_id);

CREATE INDEX IF NOT EXISTS idx_ai_creation_claims_image
  ON ai_creation_claims (image_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_creation_claims_uid_image_platform
  ON ai_creation_claims (uid, image_id, platform);
