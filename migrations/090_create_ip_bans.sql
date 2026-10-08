-- IP 封禁规则：全局 middleware 按 CF-Connecting-IP 拦截（functions/utils/ip-ban.js）
-- 后台「工具使用记录」页管理（/api/admin/ip-bans），封禁/解封最迟 15 秒在边缘生效
CREATE TABLE IF NOT EXISTS ip_bans (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL UNIQUE,               -- 封禁键：IPv4 存完整地址；IPv6 存 /64 前缀（xxxx:xxxx:xxxx:xxxx::/64）
  original_ip TEXT NOT NULL DEFAULT '',  -- 管理员提交的原始 IP（IPv6 完整地址，展示用）
  reason TEXT NOT NULL DEFAULT '',
  banned_by TEXT,                        -- 管理员 uid
  banned_by_email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT                        -- UTC 'YYYY-MM-DD HH:MM:SS'；NULL = 永久
);
