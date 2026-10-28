CREATE TABLE IF NOT EXISTS short_link_submit_limits (
  ip_hash TEXT NOT NULL,
  submit_date TEXT NOT NULL,
  created_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, submit_date)
);
