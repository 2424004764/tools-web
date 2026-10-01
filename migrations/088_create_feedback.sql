-- 用户反馈 / 建议：前台悬浮按钮提交，后台「意见反馈」模块管理，形成需求池
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  uid TEXT,                                  -- 提交者用户 id，游客为 NULL
  email TEXT NOT NULL DEFAULT '',            -- 登录用户邮箱（冗余存储，后台直读免联表）
  username TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'suggestion',   -- suggestion 功能建议 | bug 问题反馈 | other 其他
  content TEXT NOT NULL,                     -- 反馈内容
  contact TEXT NOT NULL DEFAULT '',          -- 选填联系方式（邮箱/QQ 等）
  page_url TEXT NOT NULL DEFAULT '',         -- 提交时所在页面路径
  user_agent TEXT NOT NULL DEFAULT '',
  submit_ip TEXT,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending 待处理 | resolved 已处理 | closed 已关闭
  admin_note TEXT NOT NULL DEFAULT '',       -- 后台处理备注
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_uid ON feedback(uid);
