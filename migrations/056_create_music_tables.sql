-- 音乐播放列表 /music-playlist/
-- 用户上传 mp3/m4a/wav 到 Cloudflare R2；歌曲与歌单相互独立，歌曲可任意归属 0/N 个歌单
-- play_count 每次播放 +1（不去重）；view_count 每次公开访问 +1
-- 公开播放：通过 R2.dev 子域公开桶直链，<audio> 直接播放
--
-- 执行：
--   本地  pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/056_create_music_tables.sql
--   线上  pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/056_create_music_tables.sql

-- ============ 歌曲主表 ============
CREATE TABLE IF NOT EXISTS music_songs (
  id            TEXT PRIMARY KEY,                -- uuid
  uid           TEXT NOT NULL,                  -- 关联 user.id
  slug          TEXT NOT NULL UNIQUE,           -- 公开分享短码，8 位 base36
  title         TEXT NOT NULL,
  artist        TEXT NOT NULL DEFAULT '',
  album         TEXT NOT NULL DEFAULT '',
  cover_r2_key  TEXT,                           -- 预留封面图（一期未用）
  audio_r2_key  TEXT NOT NULL,                  -- R2 对象键，如 songs/{uid}/{id}.mp3
  mime_type     TEXT NOT NULL,                  -- audio/mpeg | audio/mp4 | audio/wav
  file_size     INTEGER NOT NULL DEFAULT 0,     -- 字节
  duration_sec  REAL,                           -- 由 <audio>.duration 探测；可为 null
  is_public     INTEGER NOT NULL DEFAULT 0,     -- 1 = 公开，可通过 /song/{slug} 收听
  play_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- ============ 歌单主表 ============
CREATE TABLE IF NOT EXISTS music_playlists (
  id           TEXT PRIMARY KEY,                -- uuid
  uid          TEXT NOT NULL,                   -- 关联 user.id
  slug         TEXT NOT NULL UNIQUE,            -- 公开分享短码
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  is_public    INTEGER NOT NULL DEFAULT 0,      -- 1 = 公开，可通过 /playlist/{slug} 浏览
  view_count   INTEGER NOT NULL DEFAULT 0,
  song_count   INTEGER NOT NULL DEFAULT 0,      -- 冗余统计，加入/移除时维护
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- ============ 歌曲-歌单 多对多关联 ============
CREATE TABLE IF NOT EXISTS music_playlist_songs (
  playlist_id  TEXT NOT NULL,
  song_id      TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  added_at     TEXT NOT NULL,
  PRIMARY KEY (playlist_id, song_id),
  FOREIGN KEY (playlist_id) REFERENCES music_playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id)     REFERENCES music_songs(id)      ON DELETE CASCADE
);

-- ============ 工具注册（与 src/components/Tools/tools.ts 双注册）============
-- category_id 取自 tools.ts：7 = 其他工具
-- logo 先留空，等 public/images/logo/ 下放好图片后再 UPDATE
INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('music-playlist-2026-08-25', '音乐播放列表', '/music-playlist/', 7, '其他工具',
   '登录后上传 MP3 / M4A / WAV 音频到 Cloudflare R2，可把任意歌曲加入一个或多个歌单；每首歌与每个歌单都有独立的公开分享链接，无需登录即可收听',
   '', 141, 1, '2026-08-25 00:00:00', '2026-08-25 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;