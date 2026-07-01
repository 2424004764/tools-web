-- 修复 image_edit 模板的 extra_body.image 字段
-- 旧值：image 直接 $ref 字符串，但上游要求 URL 数组
-- 新值：image 使用 $fn: wrap 把 source_image 包成数组

UPDATE ai_models
SET input_template = json_set(
  input_template,
  '$.image_edit.extra_body.image',
  json_object('$fn', 'wrap', 'args', json_array('source_image'))
)
WHERE json_extract(input_template, '$.image_edit.extra_body.image.$ref') = 'source_image';