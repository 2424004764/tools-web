-- AI 穿搭建议：seed 默认 model 档位
-- 与 ai-image-edit 共用同一组 bafang.me 模型（gpt-image-2 + Gemini 3 系列）
-- 后端 /api/ai-outfit 把 model 原样透传给 bafang.me，无需专门适配
--
-- 关联：
--   040_add_ai_outfit.sql                      AI 穿搭建议 tool_features seed
--   034_create_tool_models.sql                 tool_models 表结构
--   035_seed_ai_image_edit_models.sql          gpt-image-2 系列 seed
--   039_seed_gemini_image_models.sql           Gemini 系列 seed（迁移时执行过）
--
-- 默认模型保持 gpt-image-2-1k（is_default=0 给 gpt-image-2-1k 与 gemini 默认 vs Gemini 系列）
--
-- 部署（远程 D1）：
--   wrangler d1 execute yifang-tool --remote --file=./functions/db/041_seed_ai_outfit_models.sql
--
-- 本地测试：
--   wrangler d1 execute yifang-tool --local --file=./functions/db/041_seed_ai_outfit_models.sql
--
-- 回滚：
--   wrangler d1 execute yifang-tool --remote --command="DELETE FROM tool_models WHERE tool_url = '/ai-outfit/';"

INSERT OR IGNORE INTO tool_models
  (tool_url, model_key, model_label, description, credit_cost, sort_order, is_enabled, is_default, created_at, updated_at)
VALUES
  ('/ai-outfit/', 'gpt-image-2-1k', 'GPT Image 2（1K）（10 积分）', '通用图片模型，支持文生图与图生图，适合人物穿搭替换', 10, 1, 1, 1, '2026-07-30 12:00:00', '2026-07-30 12:00:00'),
  ('/ai-outfit/', 'gemini-3-pro-image-preview', 'Gemini 3 Pro Image Preview（19 积分）', 'Google Gemini 3 Pro 图片预览版，旗舰质量，支持多图理解，搭配建议效果最佳', 19, 2, 1, 0, '2026-07-30 12:00:00', '2026-07-30 12:00:00'),
  ('/ai-outfit/', 'gemini-3.1-flash-image-preview', 'Gemini 3.1 Flash Image Preview（13 积分）', 'Google Gemini 3.1 Flash 图片预览版，速度快、性价比高，支持多图理解', 13, 3, 1, 0, '2026-07-30 12:00:00', '2026-07-30 12:00:00');
