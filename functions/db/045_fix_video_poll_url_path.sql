-- 修复 video_poll output_paths 中错误的 url JSONPath
-- 之前模板写的是 $.video_url，但 Agnes 接口实际字段是 $.url，导致后端抽取不到 url
-- 同时清理无意义的 remix_id 兜底字段（Agnes 的 remixed_from_video_id 永远是 null，对前端没用）
-- 部署：
--   wrangler d1 execute yifang-tool --file=./functions/db/045_fix_video_poll_url_path.sql --remote

-- 1. 命中 video_poll.url == '$.video_url' 的存量记录，一次性替换为正确的 { status: $.status, url: $.url }
UPDATE ai_models
SET output_paths = json_set(
  output_paths,
  '$.video_poll',
  json_object('status', '$.status', 'url', '$.url')
)
WHERE json_extract(output_paths, '$.video_poll.url') = '$.video_url';

-- 2. 兼容：一些模型可能根本没配 video_poll.url（早期或手工改过的）
--    这类记录补上 url 字段
UPDATE ai_models
SET output_paths = json_set(
  output_paths,
  '$.video_poll',
  json_object(
    'status', coalesce(json_extract(output_paths, '$.video_poll.status'), '$.status'),
    'url',    coalesce(json_extract(output_paths, '$.video_poll.url'),    '$.url')
  )
)
WHERE json_extract(capabilities, '$') LIKE '%video_poll%'
  AND (json_extract(output_paths, '$.video_poll') IS NULL
    OR json_extract(output_paths, '$.video_poll.url') IS NULL);