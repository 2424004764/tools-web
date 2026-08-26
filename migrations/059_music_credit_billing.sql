-- 音乐播放列表 /music-playlist/
--   1) 上传按大小积分计费（默认 2MB = 1 积分，配置可调）
--   2) 同用户按 SHA-256 查重，已存在则跳过
--   3) 删歌退 half ceil(paid)
--
-- 列变更：
--   tool_features.mb_per_credit    每个积分对应的 MB 数
--   music_songs.credit_cost_paid    上传时实际扣除的积分（用于删歌退费）
--   music_songs.credit_tx_id        关联的 deduct 流水 id（反向溯源）
--   music_songs.file_sha256         64 位小写 hex，去重键
--
-- 执行：
--   本地  pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/059_music_credit_billing.sql
--   远端  pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/059_music_credit_billing.sql

-- ============ tool_features：加 mb_per_credit ============

ALTER TABLE tool_features ADD COLUMN mb_per_credit INTEGER;

-- 给当前工具设置默认值 2（每 2MB = 1 积分）
UPDATE tool_features SET mb_per_credit = 2 WHERE url = '/music-playlist/';

-- ============ music_songs：加 cost/txId/sha256 ============

ALTER TABLE music_songs ADD COLUMN credit_cost_paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE music_songs ADD COLUMN credit_tx_id TEXT;
ALTER TABLE music_songs ADD COLUMN file_sha256 TEXT;

-- ============ 索引：唯一约束 + 查询性能 ============

-- per-user 唯一：去重 + 防并发竞态
CREATE UNIQUE INDEX IF NOT EXISTS uq_music_songs_uid_sha256
  ON music_songs(uid, file_sha256) WHERE file_sha256 IS NOT NULL;

-- 反查性能：服务端的查重 SQL 用 (uid, file_sha256)
CREATE INDEX IF NOT EXISTS idx_music_songs_uid_sha256
  ON music_songs(uid, file_sha256);
