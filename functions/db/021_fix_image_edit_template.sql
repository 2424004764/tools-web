-- 修复 image_edit 模板的 prompt 字段映射
-- 旧值：prompt 引用了 messages（数组），但上游期望字符串
-- 新值：prompt 引用 prompt（字符串），与 image_generation 保持一致
--
-- 用 SQLite 内置 replace() 直接做子串替换（避免 json_set 在某些 D1 版本上的兼容问题）
-- 仅替换 image_edit.prompt 槽位里的 "$ref":"messages"，不动其他 capability

UPDATE ai_models
SET input_template = replace(
  input_template,
  '"image_edit":{"model":{"$ref":"model_id"},"prompt":{"$ref":"messages"}',
  '"image_edit":{"model":{"$ref":"model_id"},"prompt":{"$ref":"prompt"}'
)
WHERE instr(input_template, '"image_edit":{"model":{"$ref":"model_id"},"prompt":{"$ref":"messages"}') > 0;