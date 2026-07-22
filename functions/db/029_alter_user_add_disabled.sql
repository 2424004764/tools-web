-- 给 user 表加禁用相关字段
-- is_disabled: 0=正常, 1=已禁用(无法登录)
-- disabled_reason: 禁用原因(可选)
-- disabled_at: 禁用时间(可选)
ALTER TABLE user ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user ADD COLUMN disabled_reason TEXT;
ALTER TABLE user ADD COLUMN disabled_at TEXT;
CREATE INDEX idx_user_is_disabled ON user(is_disabled);