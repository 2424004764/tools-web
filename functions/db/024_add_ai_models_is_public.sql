-- ai_models 加模型级 is_public 字段
-- 语义：管理员创建（uid=''）的模型可单独控制是否对普通用户开放
ALTER TABLE ai_models ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;

-- 回填：现有 seed 模型（uid=''）默认对所有人开放
UPDATE ai_models SET is_public = 1 WHERE uid = '';