-- 111: tool_models 上游链（failover chain）+ 注册 bafang 厂商
--
-- upstreams：JSON 有序数组，按序尝试，失败自动切换下一项（仅网络/超时/5xx/429/401/403/404 等
-- 「换厂商有意义」的错误；400/422 参数错误不切换）。每项：
--   { "provider": "bafang",            -- ai_providers.slug
--     "model_id": "gpt-image-2-1k",    -- 厂商侧真实模型 ID（与 tool_models.model_key 解耦）
--     "style": "auto" }                -- auto = gemini- 前缀走 Google 原生，否则 OpenAI 兼容
-- NULL / 空 / 解析失败 → 端点回退 legacy 行为（https://bafang.me + env.BAFANG_API_KEY）

ALTER TABLE tool_models ADD COLUMN upstreams TEXT;

-- 注册 bafang 厂商（api_key 留空：运行时兜底读 env.BAFANG_API_KEY；管理员可后台改）
INSERT INTO ai_providers
  (uid, name, slug, base_url, api_key, is_public, is_open, description, icon, sort_order, status, create_time, update_time)
SELECT '', '八方AI', 'bafang', 'https://bafang.me', '', 1, 0, '生图上游（原硬编码迁移）', '', 0, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM ai_providers WHERE slug = 'bafang' AND uid = '');

-- 存量模型回填默认链（行为零变化：与改造前 bafang + 原 model_key 直传完全等价）
UPDATE tool_models
SET upstreams = '[{"provider":"bafang","model_id":"' || model_key || '","style":"auto"}]',
    updated_at = datetime('now')
WHERE upstreams IS NULL;
