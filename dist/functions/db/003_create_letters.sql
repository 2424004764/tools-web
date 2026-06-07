CREATE TABLE IF NOT EXISTS letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sender TEXT NOT NULL,
  style TEXT NOT NULL,
  theme TEXT NOT NULL,
  content TEXT NOT NULL,
  createTime INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_letters_uid ON letters(uid);
CREATE INDEX IF NOT EXISTS idx_letters_slug ON letters(slug);
