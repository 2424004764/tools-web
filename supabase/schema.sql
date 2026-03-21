-- ================================================
-- Supabase 数据库表创建脚本
-- ================================================
-- 说明：本项目使用 Supabase 提供实时通信功能
-- 执行方式：在 Supabase Dashboard > SQL Editor 中执行
-- ================================================

-- ================================================
-- 1. 五子棋游戏房间表
-- ================================================
CREATE TABLE IF NOT EXISTS gomoku_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE,
  board JSONB NOT NULL DEFAULT '[]',
  current_player TEXT NOT NULL DEFAULT 'black',
  black_player TEXT,
  white_player TEXT,
  player_count INT DEFAULT 0,
  spectator_count INT DEFAULT 0,
  game_status TEXT NOT NULL DEFAULT 'waiting',
  winner TEXT,
  win_type TEXT,
  last_move_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 Realtime 实时同步
ALTER PUBLICATION supabase_realtime ADD TABLE gomoku_games;

-- ================================================
-- 2. 悔棋请求表
-- ================================================
CREATE TABLE IF NOT EXISTS gomoku_undo_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  requestor TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 Realtime 实时同步
ALTER PUBLICATION supabase_realtime ADD TABLE gomoku_undo_requests;

-- ================================================
-- 3. 临时聊天室消息表（如果还没有创建）
-- ================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  reply_to JSONB,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 Realtime 实时同步
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- ================================================
-- 查询验证
-- ================================================
-- 查看所有表
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 查看 Realtime 发布的表
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
