-- 修复 /ai-text-to-image/ 的 logo：库内为 ai_test_to_image.png（拼写错误），磁盘上不存在导致 404
-- 该工具为 AI 生图入口，复用 AI 图片编辑的 logo
-- 执行方式：wrangler d1 execute yifang-tool --file=./migrations/097_fix_ai_text_to_image_logo.sql --remote

UPDATE tool_features
SET logo = '/images/logo/ai_image_edit.png',
    updated_at = '2026-10-18 00:00:00'
WHERE url = '/ai-text-to-image/' AND logo = '/images/logo/ai_test_to_image.png';
