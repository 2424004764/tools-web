-- 095: 用户 token_version（JWT 撤销机制）
-- 改密 / 重置密码 / 封禁时递增，旧 JWT 因 ver claim 与库中版本不一致而立即失效。
-- 历史已签发的 token 无 ver claim，验证时按 0 处理，与列默认值一致，存量登录态不受影响。

ALTER TABLE user ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
