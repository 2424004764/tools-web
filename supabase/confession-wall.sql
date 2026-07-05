-- =====================================================================
-- 匿名告白墙 - Supabase 数据库初始化脚本
-- =====================================================================
-- 用途：在 Supabase 项目的 SQL Editor 中粘贴执行，建表 + 启用实时推送
-- 执行前：请确保已创建 Supabase 项目，并在项目根目录的 .env 中配置
--         VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY
--
-- 管理员判断：不在 Supabase 这边做。管理员判断依据项目自身的 D1 `user.is_admin`
-- 字段（参见 functions/db/020_add_user_is_admin.sql）。创建/删除分组需通过
-- Cloudflare Function（/api/confession/groups/*），由后端校验 JWT + is_admin，
-- 再用 SUPABASE_SERVICE_KEY 写入 Supabase。
--
-- 包含：
--   1. confession_groups    告白分组表（树洞、表白、广场...）
--   2. confession_messages  告白消息主表（与分组 ON DELETE CASCADE）
--   3. confession_reactions 点赞/抱抱反应表
--   4. 索引
--   5. 行级安全策略 (RLS) —— 匿名可读写告白；分组写入必须经 Cloudflare Function
--   6. Realtime 推送开关
--   7. 默认分组数据
--
-- 重新执行：本脚本使用 IF NOT EXISTS 等幂等语法，可重复执行不报错
-- =====================================================================


-- ---------- 1. 分组表 ----------
CREATE TABLE IF NOT EXISTS confession_groups (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT         NOT NULL UNIQUE,
  slug        TEXT         NOT NULL UNIQUE,
  icon        TEXT,                              -- emoji 图标
  color       TEXT,                              -- 主题色（hex）
  description TEXT,                              -- 分组简介
  sort_order  INT          DEFAULT 0,
  is_default  BOOLEAN      DEFAULT false,        -- 进入页面默认展示哪个分组
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ---------- 2. 告白消息表 ----------
CREATE TABLE IF NOT EXISTS confession_messages (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id     UUID         REFERENCES confession_groups(id) ON DELETE CASCADE,
  content      TEXT         NOT NULL,
  mood         TEXT,                             -- 心情 emoji
  color        TEXT,                             -- 卡片背景色
  likes_count  INT          DEFAULT 0,
  hugs_count   INT          DEFAULT 0,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- 兼容旧部署：若表已存在但无 group_id 列，补上
ALTER TABLE confession_messages
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES confession_groups(id) ON DELETE SET NULL;

-- 兼容旧部署：若 FK 仍是 SET NULL，改为 CASCADE（删除分组时级联删除消息）
DO $$
BEGIN
  -- 先尝试删除旧 FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE 'confession_messages_group_id_fkey'
      AND table_name = 'confession_messages'
  ) THEN
    ALTER TABLE confession_messages DROP CONSTRAINT confession_messages_group_id_fkey;
  END IF;
END $$;

-- 重新添加 CASCADE FK
ALTER TABLE confession_messages
  ADD CONSTRAINT confession_messages_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES confession_groups(id) ON DELETE CASCADE;

-- ---------- 3. 反应表 ----------
CREATE TABLE IF NOT EXISTS confession_reactions (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id       UUID         REFERENCES confession_messages(id) ON DELETE CASCADE,
  reaction_type    TEXT         NOT NULL CHECK (reaction_type IN ('like','hug')),
  user_fingerprint TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(message_id, reaction_type, user_fingerprint)
);

-- ---------- 4. 索引 ----------
CREATE INDEX IF NOT EXISTS idx_confession_created ON confession_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_confession_group   ON confession_messages(group_id, created_at DESC);

-- ---------- 5. 启用 RLS ----------
ALTER TABLE confession_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE confession_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE confession_groups   ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略（用 DO 块保证幂等，含旧版 confession_admins 的策略）
DO $$
BEGIN
  -- confession_messages 旧策略清理
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_messages' AND policyname = 'r') THEN
    DROP POLICY "r" ON confession_messages;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_messages' AND policyname = 'i') THEN
    DROP POLICY "i" ON confession_messages;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_messages' AND policyname = 'u') THEN
    DROP POLICY "u" ON confession_messages;
  END IF;
  -- confession_reactions 旧策略清理
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_reactions' AND policyname = 'rr') THEN
    DROP POLICY "rr" ON confession_reactions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_reactions' AND policyname = 'ir') THEN
    DROP POLICY "ir" ON confession_reactions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_reactions' AND policyname = 'dr') THEN
    DROP POLICY "dr" ON confession_reactions;
  END IF;
  -- confession_groups 旧策略清理
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_groups' AND policyname = 'anyone_insert_groups') THEN
    DROP POLICY "anyone_insert_groups" ON confession_groups;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_groups' AND policyname = 'anyone_update_groups') THEN
    DROP POLICY "anyone_update_groups" ON confession_groups;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_groups' AND policyname = 'anyone_delete_groups') THEN
    DROP POLICY "anyone_delete_groups" ON confession_groups;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_groups' AND policyname = 'admin_insert_groups') THEN
    DROP POLICY "admin_insert_groups" ON confession_groups;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_groups' AND policyname = 'admin_update_groups') THEN
    DROP POLICY "admin_update_groups" ON confession_groups;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_groups' AND policyname = 'admin_delete_groups') THEN
    DROP POLICY "admin_delete_groups" ON confession_groups;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'confession_groups' AND policyname = 'anyone_read_groups') THEN
    DROP POLICY "anyone_read_groups" ON confession_groups;
  END IF;
  -- 旧版 confession_admins 表清理（如果存在）
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'confession_admins') THEN
    DROP TABLE IF EXISTS confession_admins CASCADE;
  END IF;
END $$;

-- ---------- 6. RLS 策略 ----------
-- confession_messages：任何人能读、匿名发、点赞（点赞数更新需要 UPDATE 权限）
CREATE POLICY "anyone_read_messages"   ON confession_messages FOR SELECT USING (true);
CREATE POLICY "anyone_insert_messages" ON confession_messages FOR INSERT WITH CHECK (length(content) BETWEEN 1 AND 500);
CREATE POLICY "anyone_update_messages" ON confession_messages FOR UPDATE USING (true) WITH CHECK (true);

-- confession_reactions：任何人能读、点赞、取消点赞
CREATE POLICY "anyone_read_reactions"   ON confession_reactions FOR SELECT USING (true);
CREATE POLICY "anyone_insert_reactions" ON confession_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone_delete_reactions" ON confession_reactions FOR DELETE USING (true);

-- confession_groups：任何人可读；INSERT/UPDATE/DELETE 不开放给 anon key，
-- 必须用 service_role key 调用（由 Cloudflare Function 后端代理写入）
CREATE POLICY "anyone_read_groups"  ON confession_groups FOR SELECT USING (true);
-- ⚠️ 没有 INSERT/UPDATE/DELETE 的 anon policy → anon key 无法直接写
--   写操作由 Cloudflare Function 用 SUPABASE_SERVICE_KEY 完成

-- ---------- 7. 启用 Realtime 实时推送 ----------
-- 用 DO 块幂等加入 publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'confession_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE confession_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'confession_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE confession_reactions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'confession_groups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE confession_groups;
  END IF;
END $$;

-- ---------- 8. 默认分组数据（首次部署种子） ----------
INSERT INTO confession_groups (name, slug, icon, color, description, sort_order, is_default) VALUES
  ('广场', 'plaza',     '🌆', '#FFE4E1', '随便聊聊，看到什么说什么',   1, true),
  ('树洞', 'treehole',  '🌳', '#E0FFE0', '匿名倾诉，秘密只属于你',     2, false),
  ('表白', 'confession','💌', '#FFDAB9', '说出那句藏在心底的话',       3, false),
  ('许愿', 'wish',      '✨', '#FFFACD', '写下心愿，说不定会实现',     4, false),
  ('吐槽', 'roast',     '🤬', '#F0E0FF', '今天的不开心，吐出来就好',   5, false)
ON CONFLICT (slug) DO NOTHING;  -- 已存在则跳过，可重复执行

-- =====================================================================
-- 验证查询（执行后应返回非空结果）
-- =====================================================================
-- SELECT * FROM confession_groups ORDER BY sort_order;
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- =====================================================================

-- =====================================================================
-- 部署后配置步骤
-- =====================================================================
-- 1. 管理员判断不在 Supabase 这边配置 —— 它复用项目自身的 D1 `user.is_admin` 字段。
--      在 Cloudflare D1 上执行：
--      UPDATE user SET is_admin = 1 WHERE email = 'your-real-email@example.com';
--      （参考 functions/db/020_add_user_is_admin.sql）
--
-- 2. 在 Cloudflare Pages 设置中配置以下环境变量：
--      SUPABASE_URL         = https://your-project.supabase.co
--      SUPABASE_SERVICE_KEY = <your-service-role-key>  ← 用于写 confession_groups
--
-- 3. 部署前端后，访问 /confession-wall/ 页面：
--      - 未登录用户：右上角显示"🔐 登录管理"按钮，点击跳转到 /login?redirect=...
--      - 登录后非管理员：按钮变"仅浏览"
--      - 登录且 user.is_admin=1：右上角显示邮箱 + 🔑 标识，出现"+ 新分组"和分组删除按钮
--
-- 4. 完整流程详见 docs/confession-wall-auth.md
-- =====================================================================