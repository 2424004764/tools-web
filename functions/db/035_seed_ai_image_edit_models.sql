-- AI 图片编辑 model 列表 seed
-- 来自用户提供的 bafang 实测：
--   - gpt-image-2-1k：标准 1k 尺寸
--   - gpt-image-2-超分：更高清
-- 默认 cost 3 / 5，可在 /admin/tools 后台调整
--
-- 关联：
--   031_add_ai_image_edit.sql   AI 图片编辑 tool_features seed
--   034_create_tool_models.sql  本表结构
--
-- 部署：
--   wrangler d1 execute tools-web-db --file=./functions/db/035_seed_ai_image_edit_models.sql --remote

INSERT INTO tool_models (tool_url, model_key, model_label, description, credit_cost, sort_order, is_enabled, is_default, created_at, updated_at) VALUES
('/ai-image-edit/', 'gpt-image-2-1k', 'gpt-image-2 1k（标准）', '1024px 等级标准画质，速度快、成本低', 3, 0, 1, 1, '2026-07-25 00:00:00', '2026-07-25 00:00:00'),
('/ai-image-edit/', 'gpt-image-2-超分', 'gpt-image-2 超分（高清）', '更高分辨率、超采样，画质更细腻', 5, 1, 1, 0, '2026-07-25 00:00:00', '2026-07-25 00:00:00');
