-- 友情链接申请 / 审核表
-- 前台底部展示已审核通过的友链；游客可提交申请，管理员在后台审核后才公开展示。
--
-- 部署：
--   wrangler d1 execute yifang-tool --file=./functions/db/047_friend_links.sql --remote
--   本地：
--   wrangler d1 execute yifang-tool --file=./functions/db/047_friend_links.sql
--
-- status:
--   pending  = 待审核（默认，提交后进入此状态）
--   approved = 已通过（页脚公开展示）
--   rejected = 已拒绝（不展示，管理员可填写 reject_reason）

CREATE TABLE IF NOT EXISTS friend_links (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0,
  submit_ip TEXT,
  reject_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT friend_links_name_len CHECK (length(name) > 0 AND length(name) <= 40),
  CONSTRAINT friend_links_url_len CHECK (length(url) > 0 AND length(url) <= 500),
  CONSTRAINT friend_links_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_friend_links_url
  ON friend_links (url);

CREATE INDEX IF NOT EXISTS idx_friend_links_status_sort
  ON friend_links (status, sort_order ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_links_submit_ip_created
  ON friend_links (submit_ip, created_at);

INSERT OR IGNORE INTO friend_links (id, name, url, description, status, sort_order)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'linux.do',
  'https://linux.do',
  'Linux Do 社区',
  'approved',
  0
);
