-- 验证码错误尝试计数表（login / register / reset 三类验证码共用）
--
-- 背景：原先"错 5 次作废验证码"的尝试计数存 KV，而 Workers KV 对同一 key
-- 约有 1 次/秒的写入上限，超出会被节流丢弃；自动化脚本高速连击时计数大量
-- 丢失，作废阈值被实质性绕过。迁移到 D1：ON CONFLICT 原子自增，无写入频率
-- 限制，5 次上限严格生效（详见 send-verification-code.js 的 verifyCode）。
--
-- 行生命周期：发码时以 tries=0 覆写（见 send 端 INSERT ... ON CONFLICT），
-- 验证成功 / 作废 / 过期时删除；key 与 KV 验证码键（vcode:<email>:<type>）同名。
--
-- 部署：
--   wrangler d1 execute yifang-tool --file=./functions/db/048_vcode_tries.sql --remote
--   本地：
--   wrangler d1 execute yifang-tool --file=./functions/db/048_vcode_tries.sql

CREATE TABLE IF NOT EXISTS vcode_tries (
  key TEXT PRIMARY KEY,
  tries INTEGER NOT NULL DEFAULT 0,
  expires INTEGER NOT NULL
);
