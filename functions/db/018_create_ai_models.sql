-- AI 模型表
-- 存储具体模型配置，每个模型关联一个厂商
-- model_key 是前端使用的业务唯一键，格式为 "<provider_slug>/<model_id>"
CREATE TABLE IF NOT EXISTS ai_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT DEFAULT '',                   -- 创建者 UID（空=系统公开）
  provider_id INTEGER NOT NULL,          -- 关联 ai_providers.id
  name TEXT NOT NULL,                    -- 显示名（如 "Agnes Chat 2.0 Flash"）
  model_key TEXT NOT NULL,               -- 业务唯一键（如 "agnes/agnes-2.0-flash"）
  model_id TEXT NOT NULL,                -- 厂商侧的模型 ID

  -- 能力声明（决定哪些 API 可以用）
  -- JSON 数组，可选：chat, chat_stream, image_generation, image_edit, video_submit, video_poll
  capabilities TEXT NOT NULL,

  -- 端点模板（每个 capability 一个端点配置）
  -- JSON 对象，如 {"chat": {"path":"/chat/completions","method":"POST"}}
  endpoints TEXT NOT NULL,

  -- 入参模板（把通用字段映射到厂商请求体）
  -- JSON 对象，使用 $ref/$const/$fn DSL
  input_template TEXT NOT NULL,

  -- 出参路径（每个 capability 一个字段抽取路径）
  -- JSON 对象，使用 $.a.b[0].c 简化 JSONPath
  output_paths TEXT NOT NULL,

  description TEXT,
  icon TEXT,
  is_public INTEGER NOT NULL DEFAULT 0, -- 管理员模型可单独控制是否对普通用户开放
  sort_order INTEGER DEFAULT 0,
  status INTEGER DEFAULT 1,              -- 1=启用，0=禁用
  create_time TEXT NOT NULL,
  update_time TEXT NOT NULL,

  UNIQUE(uid, model_key),
  FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE CASCADE
);

