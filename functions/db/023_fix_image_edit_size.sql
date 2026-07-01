-- 修复 image_edit 模板的 size 字段
-- 旧值：size 写死 "$const":"1024x1024"（忽略用户选择的比例）
-- 新值：size 用 "$fn":"join" 把 width × height 拼出来（与 image_generation 一致）

UPDATE ai_models
SET input_template = replace(
  input_template,
  '"image_edit":{"model":{"$ref":"model_id"},"prompt":{"$ref":"prompt"},"size":{"$const":"1024x1024"}',
  '"image_edit":{"model":{"$ref":"model_id"},"prompt":{"$ref":"prompt"},"size":{"$fn":"join","args":["width","height","x"]}'
)
WHERE instr(input_template, '"image_edit":{"model":{"$ref":"model_id"},"prompt":{"$ref":"prompt"},"size":{"$const":"1024x1024"}') > 0;