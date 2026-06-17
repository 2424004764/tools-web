-- AI应用表
-- 用于存储AI应用中心的应用配置信息，包括系统应用和用户自建应用
CREATE TABLE IF NOT EXISTS ai_apps (
  id TEXT PRIMARY KEY,              -- 应用唯一标识，如：dream-analysis
  name TEXT NOT NULL,                -- 应用名称（用于路由），与id相同
  icon TEXT NOT NULL,                -- emoji图标，如：🌙
  title TEXT NOT NULL,               -- 显示标题，如：AI解梦
  description TEXT NOT NULL,         -- 应用描述
  category TEXT DEFAULT 'general',   -- 分类：life/travel/image/text/health/legal/general
  gradient_from TEXT NOT NULL,       -- Tailwind渐变起始色，如：purple-50
  gradient_to TEXT NOT NULL,         -- Tailwind渐变结束色，如：blue-50
  border_color TEXT NOT NULL,        -- Tailwind边框色（hover时），如：purple-400
  sort_order INTEGER DEFAULT 0,      -- 排序顺序，数字越小越靠前
  status INTEGER DEFAULT 1,          -- 状态：1=上架，0=下架
  app_type TEXT DEFAULT 'system',    -- 应用类型：system=系统应用，custom=用户自建
  uid TEXT DEFAULT '',               -- 创建者UID（系统应用为空，自建应用必填）
  system_prompt TEXT DEFAULT '',     -- AI系统提示词（用户自建应用使用）
  create_time TEXT NOT NULL,         -- 创建时间
  update_time TEXT NOT NULL          -- 更新时间
);

-- 为用户自建应用查询创建索引
CREATE INDEX IF NOT EXISTS idx_ai_apps_uid ON ai_apps(uid);
CREATE INDEX IF NOT EXISTS idx_ai_apps_type ON ai_apps(app_type);

