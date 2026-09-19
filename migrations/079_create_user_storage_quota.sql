-- 统一存储额度：所有 R2 上传（购物清单图片 / AI 创作图 / 音乐 / AI 生成图）共用
--   - 积分购买额度：1 积分 = 100MB（常量见 functions/config/storage.js）
--   - 新用户不赠送额度，quota_bytes 从 0 开始
--   - 剩余额度 = quota_bytes - used_bytes - 未过期预留(storage_reservations)
--
-- 音乐模块原独立配额（music_user_quota 免费额度 + 按量积分计费）并入本表：
--   存量用户 used_bytes = 其 music_songs 文件总大小，
--   quota_bytes = MAX(总大小, 30MB)，即老用户保留原免费额度，不回退。
--
-- 执行：npx wrangler d1 execute yifang-tool --remote --file=migrations/079_create_user_storage_quota.sql
-- 本地：npx wrangler d1 execute yifang-tool --local --file=migrations/079_create_user_storage_quota.sql

CREATE TABLE IF NOT EXISTS user_storage_quota (
  uid        TEXT PRIMARY KEY,
  quota_bytes INTEGER NOT NULL DEFAULT 0,
  used_bytes  INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 上传预留：签名前预扣，confirm 按实际大小结算，超时（1 小时）自动视为失效
CREATE TABLE IF NOT EXISTS storage_reservations (
  id         TEXT PRIMARY KEY,
  uid        TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_uid_created
  ON storage_reservations (uid, created_at);

-- 音乐存量并入统一配额（老用户保留原 30MB 免费额度）
INSERT INTO user_storage_quota (uid, quota_bytes, used_bytes, updated_at)
SELECT uid, MAX(total_bytes, 31457280), total_bytes, datetime('now')
FROM (
  SELECT uid, SUM(COALESCE(file_size, 0)) AS total_bytes
  FROM music_songs
  GROUP BY uid
)
WHERE true
ON CONFLICT(uid) DO UPDATE SET
  used_bytes  = MAX(used_bytes, excluded.used_bytes),
  quota_bytes = MAX(quota_bytes, excluded.quota_bytes),
  updated_at  = datetime('now');

-- 音乐独立配额表废弃
DROP TABLE IF EXISTS music_user_quota;
