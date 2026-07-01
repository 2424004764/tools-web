-- ai_providers 加 is_open 字段
-- 区分可见性（is_public）和"是否接受用户自己提供的 api_key"（is_open）
-- is_open=1：游客 / 普通用户可以用自己的 Key 调用此厂商下的模型
-- is_open=0：只有管理员能用（自己的 Key 或厂商 Key）
ALTER TABLE ai_providers ADD COLUMN is_open INTEGER NOT NULL DEFAULT 0;

-- 回填：默认公开的 Agnes 厂商标为开放 Key（让游客能用）
UPDATE ai_providers SET is_open = 1 WHERE is_public = 1;