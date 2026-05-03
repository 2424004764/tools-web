-- 短链接表
CREATE TABLE IF NOT EXISTS short_links (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  title TEXT DEFAULT '',
  uid TEXT DEFAULT '',
  clicks INTEGER DEFAULT 0,
  expire_at TEXT,
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_short_links_slug ON short_links(slug);
CREATE INDEX IF NOT EXISTS idx_short_links_uid ON short_links(uid);
