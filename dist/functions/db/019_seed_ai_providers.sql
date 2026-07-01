-- 默认 AI 厂商和模型配置（Agnes AI）
-- 首次部署时插入系统级公开配置，保证现有功能开箱即用
-- 使用 OR IGNORE 避免重复插入

-- Agnes AI 厂商（系统级公开 + 接受游客 Key）
INSERT OR IGNORE INTO ai_providers (
  id, uid, name, slug, base_url, api_key, is_public, is_open,
  description, icon, sort_order, status, create_time, update_time
) VALUES (
  1, '', 'Agnes AI', 'agnes', 'https://apihub.agnes-ai.com/v1', '',
  1, 1,
  'Agnes AI 官方 API，提供对话、视频生成、图像生成等能力',
  '🤖', 1, 1, datetime('now'), datetime('now')
);

-- Agnes Chat 2.0 Flash（对话模型，流式）
INSERT OR IGNORE INTO ai_models (
  uid, provider_id, name, model_key, model_id,
  capabilities, endpoints, input_template, output_paths,
  is_public, description, sort_order, status, create_time, update_time
) VALUES (
  '', 1, 'Agnes Chat 2.0 Flash', 'agnes/agnes-2.0-flash', 'agnes-2.0-flash',
  '["chat","chat_stream"]',
  '{"chat":{"path":"/chat/completions","method":"POST"},"chat_stream":{"path":"/chat/completions","method":"POST"}}',
  '{"model":{"$ref":"model_id"},"messages":{"$ref":"messages"},"stream":{"$const":true},"temperature":{"$ref":"temperature"}}',
  '{"chat":{"content":"$.choices[0].message.content"},"chat_stream":{"delta":"$.choices[0].delta.content"}}',
  1, 'Agnes 通用对话模型（快速版），支持多轮对话和流式输出', 1, 1, datetime('now'), datetime('now')
);

-- Agnes Video v2.0（视频生成）
INSERT OR IGNORE INTO ai_models (
  uid, provider_id, name, model_key, model_id,
  capabilities, endpoints, input_template, output_paths,
  is_public, description, sort_order, status, create_time, update_time
) VALUES (
  '', 1, 'Agnes Video v2.0', 'agnes/agnes-video-v2.0', 'agnes-video-v2.0',
  '["video_submit","video_poll"]',
  '{"video_submit":{"path":"/videos","method":"POST"},"video_poll":{"path":"/agnesapi","method":"GET","query":"video_id={video_id}"}}',
  '{"model":{"$ref":"model_id"},"prompt":{"$ref":"prompt"},"num_frames":{"$ref":"frames"},"frame_rate":{"$const":24},"width":{"$ref":"width"},"height":{"$ref":"height"},"extra_body":{"image":{"$ref":"images","$omitIfEmpty":true}}}',
  '{"video_submit":{"video_id":"$.video_id"},"video_poll":{"status":"$.status","url":"$.video_url","remix_id":"$.remixed_from_video_id"}}',
  1, 'Agnes 视频生成模型，支持文生视频和图生视频', 2, 1, datetime('now'), datetime('now')
);

-- Agnes Image 2.1 Flash（图像生成）
INSERT OR IGNORE INTO ai_models (
  uid, provider_id, name, model_key, model_id,
  capabilities, endpoints, input_template, output_paths,
  is_public, description, sort_order, status, create_time, update_time
) VALUES (
  '', 1, 'Agnes Image 2.1 Flash', 'agnes/agnes-image-2.1-flash', 'agnes-image-2.1-flash',
  '["image_generation","image_edit"]',
  '{"image_generation":{"path":"/images/generations","method":"POST"},"image_edit":{"path":"/images/generations","method":"POST"}}',
  '{"image_generation":{"model":{"$ref":"model_id"},"prompt":{"$ref":"prompt"},"size":{"$fn":"join","args":["width","height","x"]},"extra_body":{"response_format":{"$const":"url"}}},"image_edit":{"model":{"$ref":"model_id"},"prompt":{"$ref":"prompt"},"size":{"$fn":"join","args":["width","height","x"]},"extra_body":{"image":{"$fn":"wrap","args":["source_image"]},"response_format":{"$const":"url"}}}}',
  '{"image_generation":{"url":"$.data[0].url"},"image_edit":{"url":"$.data[0].url"}}',
  1, 'Agnes 图像生成模型，支持文生图和图生图', 3, 1, datetime('now'), datetime('now')
);