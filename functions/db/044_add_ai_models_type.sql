-- 给 ai_models 增加 type 字段（业务类型），方便各工具按类型筛选
-- 取值：text（文生文 / 通用对话）、image（文生图 / 图生图）、video（文生视频 / 图生视频）
-- 注意：capabilities 仍是端点级别的能力声明，type 是更宏观的业务类别（一个模型通常只对应一个 type）
-- 部署：
--   wrangler d1 execute yifang-tool --file=./functions/db/044_add_ai_models_type.sql --remote

-- 1. 加列，默认 text 兼容老数据
ALTER TABLE ai_models ADD COLUMN type TEXT NOT NULL DEFAULT 'text';

-- 2. 根据已有 capabilities 回填 type
UPDATE ai_models SET type = 'image' WHERE type = 'text' AND capabilities LIKE '%image_%';
UPDATE ai_models SET type = 'video' WHERE type = 'text' AND capabilities LIKE '%video_%';

-- 3. 加索引，方便按 type 过滤
CREATE INDEX IF NOT EXISTS idx_ai_models_type ON ai_models(type);
