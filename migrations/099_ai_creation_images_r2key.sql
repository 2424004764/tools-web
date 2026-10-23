-- 099: ai_creation_images 增加独立 r2_key 列（安全修复配套迁移）
--
-- 背景（渗透测试 HIGH 发现）：save/confirm 只校验了 r2_key 的命名空间，
-- 却把客户端提供的 public_url 原样写入 media_url；DELETE 接口再从 media_url
-- 反推出 key，用服务端桶级 R2 凭据删除对象——任意登录用户可借此删除共享桶
-- tools-web 内任意其他用户的对象，并按对象真实大小给自己退还存储额度。
--
-- 修复：
--   1) confirm 端服务端计算 media_url（buildR2PublicUrl(env, r2_key)），
--      不再信任客户端 public_url，同时把 r2_key 落入本列；
--   2) 各 DELETE 端只信任 r2_key 列（老数据回填自 media_url），
--      且删除对象前强制校验 key 位于 ai-creations/{uid}/ 命名空间内。

ALTER TABLE ai_creation_images ADD COLUMN r2_key TEXT;

-- 历史数据回填：media_url 可能是 R2 公网 URL（r2.dev 或自定义域 tool-r2.fologde.com）
-- 或裸 key 字符串。URL 取路径中 ai-creations/ / generated-images/ 起的部分，
-- 与域名无关（域名几经更换，且解析结果仍要过删除接口的命名空间校验）。
-- 回填出的 r2_key 若指向他人命名空间（被毒化的历史数据），删除接口的
-- 前缀校验会拒绝对其执行 R2 删除 / 退额度，只删 DB 行，不再有破坏力。
-- 注：substr(CASE 写法避开 CMD % 通配符转义问题，与线上执行版本一致。
UPDATE ai_creation_images
SET r2_key = CASE
  WHEN substr(media_url, 1, 8) = 'https://' AND instr(media_url, '/ai-creations/') > 0
    THEN substr(media_url, instr(media_url, '/ai-creations/') + 1)
  WHEN substr(media_url, 1, 8) = 'https://' AND instr(media_url, '/generated-images/') > 0
    THEN substr(media_url, instr(media_url, '/generated-images/') + 1)
  WHEN substr(media_url, 1, 4) != 'http' AND length(media_url) > 0
    THEN ltrim(media_url, '/')
  ELSE NULL
END
WHERE r2_key IS NULL
  AND media_url IS NOT NULL;
