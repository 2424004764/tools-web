-- 子站上传体系：统一凭证下发 + 队列事件实扣
--   流程：子站(=OAuth client) → POST /api/oauth/storage-upload-credential 预扣额度并写本表
--         → R2 预签名 PUT（content-length 锁定，大小不符 R2 直接 403）
--         → 子站桶 PutObject 事件通知 → Cloudflare Queue → tools-web-worker
--         → worker 按本表幂等实扣（used_bytes += declared_bytes、释放预占、status=settled）
-- 执行：npx wrangler d1 execute yifang-tool --remote --file=migrations/093_subsite_uploads.sql
-- 本地：npx wrangler d1 execute yifang-tool --local --file=migrations/093_subsite_uploads.sql

-- 1) OAuth client（子站）登记专属 R2 桶名：空 = 未开通上传，凭证接口直接拒绝
ALTER TABLE oauth_clients ADD COLUMN r2_bucket TEXT NOT NULL DEFAULT '';

-- 2) 子站上传记录：凭证下发时创建，worker 依据本表做幂等实扣
CREATE TABLE IF NOT EXISTS subsite_uploads (
  id             TEXT PRIMARY KEY,                 -- upload_id（= 对象 key 第三段，事件回溯主键）
  uid            TEXT NOT NULL,                    -- 主站用户 id（额度归属）
  client_id      TEXT NOT NULL,                    -- 发起上传的子站 oauth_clients.client_id
  bucket         TEXT NOT NULL,                    -- 目标 R2 桶（子站专属桶）
  object_key     TEXT NOT NULL,                    -- 对象 key：subsite/{uid}/{upload_id}/{filename}
  declared_bytes INTEGER NOT NULL,                 -- 凭证申请声明的字节数（预签名已锁定该长度）
  content_type   TEXT NOT NULL DEFAULT '',         -- 预签名锁定的 Content-Type
  reservation_id TEXT NOT NULL,                    -- 对应 storage_reservations.id（预扣记录）
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending / settled / rejected / expired
  actual_bytes   INTEGER,                          -- R2 事件回报的实际大小（settled/rejected 时回填）
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_subsite_uploads_client_created
  ON subsite_uploads (client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subsite_uploads_status_created
  ON subsite_uploads (status, created_at);
