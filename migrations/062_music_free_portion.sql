-- 音乐播放列表：记录每首歌实际占用的免费额度字节数
--   用于删除歌曲时把对应字节数退回 music_user_quota.free_bytes_used
--
-- 写入规则（functions/services/musicService.js requestUploadUrl）：
--   - 单文件上传：free_portion_bytes = min(fileSize, 剩余免费额度)
--   - 批次首新文件（payer）：free_portion_bytes = 整个批次的 freePortion
--     （整个批次的免费字节全部挂在 payer 名下，其余同批歌曲 free_portion_bytes = 0）
--   - 批次非 payer：free_portion_bytes = 0
--
-- 删除规则（deleteSong）：
--   - credit_cost_paid > 0 且 credit_tx_id 有效 → 走 ceil(paid/2) 退积分（原有逻辑）
--   - free_portion_bytes > 0 → releaseFreeQuota(uid, free_portion_bytes)
--
-- 执行：
--   本地  pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/062_music_free_portion.sql
--   远端  pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/062_music_free_portion.sql

ALTER TABLE music_songs ADD COLUMN free_portion_bytes INTEGER NOT NULL DEFAULT 0;