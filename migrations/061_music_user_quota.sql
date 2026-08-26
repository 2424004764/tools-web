-- 音乐播放列表：每用户终身累计免费上传额度（50 MB）
--
-- 设计取舍：
--   - 不放在 user_credits（那里只管「积分余额」语义，混进去污染计费概念）
--   - 不放在 tool_features（同上，只放工具开关/logo 等元数据）
--   - 单独一张 music_user_quota(uid PK) 即可；只有「按音乐业务查询/修改」才会动它
--
-- 计费规则（functions/services/musicService.js）：
--   - 读 music_user_quota.free_bytes_used，记为 F
--   - 本批次大小 S
--   - freePortion = min(S, 50 MB - F)   ← 走免费额度的字节
--   - paidPortion = S - freePortion     ← 走积分计费的字节
--   - cost = paidPortion > 0 ? calcCreditCost(paidPortion) : 0
--   - new free_bytes_used = min(F + S, 50 MB)
--
-- 删歌退额（deleteSong）：
--   - 如果 credit_cost_paid = 0（免费歌曲）→ 把 file_size 加回 free_bytes_used 上限 50 MB
--   - 如果 credit_cost_paid > 0 → 走原有 ceil(paid/2) 积分退费
--
-- 执行：
--   本地  pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/061_music_user_quota.sql
--   远端  pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/061_music_user_quota.sql

CREATE TABLE IF NOT EXISTS music_user_quota (
  uid TEXT PRIMARY KEY,
  free_bytes_used INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_music_user_quota_updated_at
  ON music_user_quota(updated_at);