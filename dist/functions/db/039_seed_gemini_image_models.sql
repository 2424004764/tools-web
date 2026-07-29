-- AI 图片编辑：追加 Gemini 3 系列图片模型
-- 来源：用户要求接入 bafang.me 已支持的 Gemini 图片模型
--   - gemini-3-pro-image-preview：旗舰级，支持文生图 + 图生图
--   - gemini-3.1-flash-image-preview：Flash 性价比款，同样支持文生图 + 图生图
--
-- 后端不动：
--   - /api/ai-image-edit 始终把 model 字段原样透传给 bafang.me
--   - 上传图片时走 /v1/images/edits（image-to-image），不上传走 /v1/images/generations
--   - 两个模型都支持图生图，所以本次只需在 tool_models 里登记，无需改后端或前端
--
-- 关联：
--   031_add_ai_image_edit.sql               AI 图片编辑 tool_features seed
--   034_create_tool_models.sql              tool_models 表结构
--   035_seed_ai_image_edit_models.sql       现有 gpt-image-2 系列 seed
--
-- 默认模型保持 gpt-image-2-1k（is_default=0 给新模型），不抢现有用户习惯
--
-- 部署（远程 D1）：
--   wrangler d1 execute yifang-tool --remote --file=./functions/db/039_seed_gemini_image_models.sql
--
-- 本地测试（可选）：
--   wrangler d1 execute yifang-tool --local --file=./functions/db/039_seed_gemini_image_models.sql
--
-- 回滚（删除本次新增的两个模型）：
--   wrangler d1 execute yifang-tool --remote --command="DELETE FROM tool_models WHERE tool_url = '/ai-image-edit/' AND model_key IN ('gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview');"

INSERT OR IGNORE INTO tool_models (tool_url, model_key, model_label, description, credit_cost, sort_order, is_enabled, is_default, created_at, updated_at) VALUES
('/ai-image-edit/', 'gemini-3-pro-image-preview', 'Gemini 3 Pro Image Preview（19 积分）', 'Google Gemini 3 Pro 图片预览版，旗舰质量，支持文生图与图生图', 19, 2, 1, 0, '2026-07-29 00:00:00', '2026-07-29 00:00:00'),
('/ai-image-edit/', 'gemini-3.1-flash-image-preview', 'Gemini 3.1 Flash Image Preview（13 积分）', 'Google Gemini 3.1 Flash 图片预览版，速度快、性价比高，支持文生图与图生图', 13, 3, 1, 0, '2026-07-29 00:00:00', '2026-07-29 00:00:00');