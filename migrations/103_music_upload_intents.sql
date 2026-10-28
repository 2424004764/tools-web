CREATE TABLE IF NOT EXISTS music_upload_intents (
  song_id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_sha256 TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_music_upload_intents_uid_created
  ON music_upload_intents(uid, created_at);
