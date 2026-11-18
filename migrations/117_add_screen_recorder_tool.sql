-- 新增工具 /screen-recorder/（屏幕录制）
-- 数据来源：src/components/Tools/tools.ts（tools.ts 内 id='screen-recorder-2026-11-18'，保持一致）
-- category_id 含义：5=图片处理

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('screen-recorder-2026-11-18', '屏幕录制', '/screen-recorder/', 5, '图片处理',
   '浏览器直接录制屏幕/窗口/标签页为视频，支持系统声音与麦克风混音、清晰度帧率设置、暂停续录，纯本地处理不上传',
   '/images/logo/screen-recorder.png', 205, 1, '2026-11-18 00:00:00', '2026-11-18 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
