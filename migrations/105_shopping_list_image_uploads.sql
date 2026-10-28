CREATE TABLE IF NOT EXISTS shopping_list_image_uploads (
  r2_key TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  declared_bytes INTEGER NOT NULL,
  actual_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  lock_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_image_uploads_uid_status
  ON shopping_list_image_uploads (uid, status);
