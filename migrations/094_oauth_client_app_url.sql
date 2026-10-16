-- OAuth 客户端应用连接地址（后台列表用于打开应用）
-- 执行：npx wrangler d1 execute yifang-tool --remote --file=migrations/094_oauth_client_app_url.sql
-- 本地：npx wrangler d1 execute yifang-tool --local --file=migrations/094_oauth_client_app_url.sql

ALTER TABLE oauth_clients ADD COLUMN app_url TEXT NOT NULL DEFAULT '';
