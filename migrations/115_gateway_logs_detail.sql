-- 115: gateway_logs 调用明细升级
-- 每次网关请求记录完整出入参与性能指标，便于排障与用量分析：
--   request_body    请求入参（canonical payload JSON；data URL/base64 脱敏为占位，超长截断）
--   response_body   响应出参（非流式=归一化结果；流式=累计的完整输出文本；图片=占位摘要）
--   ttft_ms         首字时间（流式=首个 delta 到达；非流式=总耗时，即响应唯一一次"到达"）
--   input_tokens    上游 usage 输入 token（流式依赖上游 usage 事件，缺失为 0）
--   output_tokens   上游 usage 输出 token（同上）
--   finish_reason   结束原因（stop / length / content_filter / error …）
--   attempts_detail 容灾尝试链明细 JSON：[{provider, model_id, status, durationMs, error}]
-- 既有 duration_ms 保留 = 总耗时（含调度/failover 全程）。
-- 不加索引（同 114 策略，量级上来再按需补）。

ALTER TABLE gateway_logs ADD COLUMN request_body TEXT NOT NULL DEFAULT '';
ALTER TABLE gateway_logs ADD COLUMN response_body TEXT NOT NULL DEFAULT '';
ALTER TABLE gateway_logs ADD COLUMN ttft_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gateway_logs ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gateway_logs ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gateway_logs ADD COLUMN finish_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE gateway_logs ADD COLUMN attempts_detail TEXT NOT NULL DEFAULT '';
