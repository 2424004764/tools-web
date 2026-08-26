-- 音乐播放列表计费：一次性整合迁移（合并 059 / 061 / 062）
--
-- 背景：
--   059_music_credit_billing.sql  → 给 tool_features 加 mb_per_credit + 给 music_songs 加 credit_cost_paid/credit_tx_id/file_sha256 + 建索引
--   060_drop_mb_per_credit.sql   → 撤回 059 在 tool_features 上加的 mb_per_credit（改为 functions/config/music.js 静态配置）
--   061_music_user_quota.sql     → 建 music_user_quota 表
--   062_music_free_portion.sql   → 给 music_songs 加 free_portion_bytes
--
-- 上面 4 个迁移在生产都未执行过。本次合并时：
--   - 059 没跑 → tool_features 上本来就没有 mb_per_credit 列，060 的 DROP COLUMN 会失败
--   - 同时我们也不再希望 mb_per_credit 出现在 tool_features（已改走 functions/config/music.js）
--   → 060 整段跳过；mb_per_credit 既不加也不 drop
--
-- 本次合并产物：
--   1) music_songs 加四列（credit_cost_paid / credit_tx_id / file_sha256 / free_portion_bytes）
--   2) music_songs 建索引（uid+sha256 唯一 + 普通）
--   3) 新建 music_user_quota 表 + updated_at 索引
--
-- 执行：
--   本地  pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/063_consolidated_music_billing.sql
--   远端  pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/063_consolidated_music_billing.sql

-- 1) music_songs 加四列
ALTER TABLE music_songs ADD COLUMN credit_cost_paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE music_songs ADD COLUMN credit_tx_id TEXT;
ALTER TABLE music_songs ADD COLUMN file_sha256 TEXT;
ALTER TABLE music_songs ADD COLUMN free_portion_bytes INTEGER NOT NULL DEFAULT 0;

-- 2) (uid, file_sha256) 唯一索引（去重 + 防并发竞态）
CREATE UNIQUE INDEX IF NOT EXISTS uq_music_songs_uid_sha256
  ON music_songs(uid, file_sha256) WHERE file_sha256 IS NOT NULL;

--    旧数据可能存在 file_sha256 为 NULL 的行（迁移前的老歌曲），
--    WHERE 过滤保证 NULL 不参与唯一性比较，避免冲突。
CREATE INDEX IF NOT EXISTS idx_music_songs_uid_sha256
  ON music_songs(uid, file_sha256);

-- 3) music_user_quota：每用户终身累计免费上传额度
CREATE TABLE IF NOT EXISTS music_user_quota (
  uid TEXT PRIMARY KEY,
  free_bytes_used INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_music_user_quota_updated_at
  ON music_user_quota(updated_at);

-- 4) 同步更新 tool_features.description（首页卡片展示的简介）
--    与 src/components/Tools/tools.ts 的 desc 字段保持一致
UPDATE tool_features
SET description = '登录后上传 MP3 / M4A / WAV 音频到 R2，可把任意歌曲加入一个或多个歌单；每首歌与每个歌单都有独立的公开分享链接，无需登录即可收听。不会压缩音质，完全原版上传',
    updated_at  = '2026-08-26 00:00:00'
WHERE url = '/music-playlist/';