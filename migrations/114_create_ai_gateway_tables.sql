-- 114: 统一 AI 网关（全新独立一套，不影响 ai_providers / ai_models / tool_models 旧链路）
--
-- gateway_providers : 厂商接入（base_url + api_key + protocol 出协议）
--   protocol: 'openai'（OpenAI 及一切兼容中转：DeepSeek/Kimi/GLM/硅基流动/OpenRouter…）
--             'anthropic'（Claude 原生 /v1/messages）
--             'gemini'（Google 原生 /v1beta/models/{model}:generateContent）
-- gateway_models    : 模型注册（厂商侧 model_id + 能力集 chat/image_gen/image_edit/video）
-- gateway_groups    : 调度组（group_key + 候选链 candidates JSON，按 priority 升序依序容灾）
-- gateway_logs      : 网关调用日志（哪个组/厂商/模型、成败、耗时、错误摘要）
--
-- 幂等：全部 IF NOT EXISTS，可重复执行。
-- 索引暂不建：初期均为小表（PK 查询足够；日志查询走 ORDER BY id DESC），
-- 量级上来后再按需补 idx_gateway_logs(group_key, id DESC) 等。

CREATE TABLE IF NOT EXISTS gateway_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  protocol TEXT NOT NULL DEFAULT 'openai',
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL DEFAULT '',
  status INTEGER NOT NULL DEFAULT 1,
  remark TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gateway_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  model_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  capabilities TEXT NOT NULL DEFAULT '["chat"]',
  status INTEGER NOT NULL DEFAULT 1,
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider_id, model_id)
);

CREATE TABLE IF NOT EXISTS gateway_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  candidates TEXT NOT NULL DEFAULT '[]',
  status INTEGER NOT NULL DEFAULT 1,
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gateway_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL DEFAULT '',
  capability TEXT NOT NULL DEFAULT '',
  group_key TEXT NOT NULL DEFAULT '',
  provider_slug TEXT NOT NULL DEFAULT '',
  model_id TEXT NOT NULL DEFAULT '',
  ok INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 1,
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
