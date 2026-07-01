-- 用户收藏AI应用表
-- 记录用户收藏的 AI 应用（系统应用 + 自建应用）
-- 通过 uid + app_id 唯一索引避免重复收藏
CREATE TABLE IF NOT EXISTS user_favorite_apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,                   -- 用户UID
  app_id TEXT NOT NULL,                -- 应用ID（对应 ai_apps.id）
  app_type TEXT NOT NULL,              -- 应用类型：system=系统应用，custom=自建应用（冗余字段便于过滤）
  create_time TEXT NOT NULL,           -- 收藏时间
  UNIQUE(uid, app_id)                  -- 同一用户同一应用只能收藏一次
);
