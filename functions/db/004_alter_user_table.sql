-- 为现有 user 表添加邮箱登录所需字段
ALTER TABLE user ADD COLUMN password TEXT;
ALTER TABLE user ADD COLUMN salt TEXT;

-- 为 email 添加索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
