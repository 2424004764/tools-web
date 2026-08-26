-- 撤回 059 加在 tool_features 上的 mb_per_credit：
--   这字段只对音乐播放列表有意义，加在通用 tool_features 上会污染其他工具。
--   改为 functions/config/music.js 静态配置（参见 musicService.js 的导入）。
--
-- 注意：SQLite 不支持 ALTER TABLE DROP COLUMN IF EXISTS，
--   本地 DB 从未跑过 059（没这列），所以本地不需要执行；仅在远端执行。
ALTER TABLE tool_features DROP COLUMN mb_per_credit;