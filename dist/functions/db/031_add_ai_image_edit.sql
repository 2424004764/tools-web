-- 新增 AI 图片编辑工具
-- id 使用 UUID（与 tool_features 表 TEXT PRIMARY KEY 匹配）
INSERT INTO tool_features (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES ('3889b1f9-8016-40cd-8d49-39073602a6b5', 'AI图片编辑', '/ai-image-edit/', 10, 'AI工具', 'AI智能图片编辑，支持文生图和图生图，上传图片+文字描述即可一键生成或修改图片', '/images/logo/ai_image_edit.svg', 135, 1, datetime('now'), datetime('now'));
