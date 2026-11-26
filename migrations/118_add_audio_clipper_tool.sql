-- 新增工具 /audio-clipper/（音频剪辑器）
-- 数据来源：src/components/Tools/tools.ts（tools.ts 内 id='audio-clipper-2026-11-18'，保持一致）
-- category_id 含义：7=其他工具

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('audio-clipper-2026-11-18', '音频剪辑器', '/audio-clipper/', 7, '其他工具',
   'Web Audio 波形可视化裁剪音频，支持选区播放循环、淡入淡出，导出 MP3 / OGG / WAV，纯前端本地处理不上传',
   '/images/logo/audio-clipper.png', 206, 1, '2026-11-18 00:00:00', '2026-11-18 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
