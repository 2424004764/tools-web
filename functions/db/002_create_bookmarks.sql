CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  is_read INTEGER DEFAULT 0,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_uid ON bookmarks(uid);
