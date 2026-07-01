-- AI 厂商表
-- 存储 AI 服务厂商信息（OpenAI、Agnes、自建 OpenAI 兼容服务等）
-- 支持公开厂商（管理员建，所有用户用）和私有厂商（用户自建，仅自己用）
CREATE TABLE IF NOT EXISTS ai_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT DEFAULT '',                  -- 创建者 UID（空=系统公开，非空=私有所有者）
  name TEXT NOT NULL,                    -- 显示名（如 "Agnes AI"）
  slug TEXT NOT NULL,                    -- 唯一键（如 "agnes"），前端 modelKey 前缀
  base_url TEXT NOT NULL,                -- 根 URL（如 https://apihub.agnes-ai.com/v1）
  api_key TEXT DEFAULT '',               -- 公开厂商由管理员填入，私有厂商由用户自填
  is_public INTEGER DEFAULT 0,           -- 1=公开给所有用户，0=仅自己可见
  is_open INTEGER NOT NULL DEFAULT 0,    -- 1=接受游客/普通用户自己提供的 api_key；0=只有管理员能用
  description TEXT,                      -- 厂商描述
  icon TEXT,                             -- emoji 或图标 URL
  sort_order INTEGER DEFAULT 0,
  status INTEGER DEFAULT 1,              -- 1=启用，0=禁用
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL,
  UNIQUE(uid, slug)
);

