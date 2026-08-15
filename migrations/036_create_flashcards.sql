-- 闪卡复习系统表
--
-- 用途：Anki 风格的间隔重复（SRS）闪卡复习工具。
-- 用户创建多个 deck（卡组），每个 deck 下添加多张卡片，
-- 系统按 SM-2 简化算法计算每张卡片的 due_at，到期卡片进入今日复习队列。
--
-- 数据隔离：用户级，每个登录用户各自的 decks / cards / reviews 互不可见。
-- 卡片正面/背面支持 Markdown（前端渲染）；存储层不做格式转换。
--
-- 调度算法（API 层按 grade 计算下次 due_at 后写入本表）：
--   grade 0 (Again):  重置 repetitions=0, interval_days=0（due 立即可复习）
--   grade 3 (Hard):   repetitions++, interval_days *= 1.2, ease -= 0.15
--   grade 4 (Good):   repetitions++, interval_days 按 ease_factor 计算
--   grade 5 (Easy):   repetitions++, interval_days *= ease * 1.3, ease += 0.15
--   ease_factor 始终 clamp >= 1.3
--
-- 时间约定：due_at / created_at / updated_at / reviewed_at 一律存毫秒时间戳（INTEGER），
-- 与项目内 user_credits 等 D1 表保持数字类型一致；前端按需 toLocaleString。

CREATE TABLE IF NOT EXISTS flashcard_decks (
    id          TEXT PRIMARY KEY,            -- UUID
    uid         TEXT NOT NULL,               -- 用户 ID（与 user.id / user_credits.uid 同类型）
    name        TEXT NOT NULL,               -- 卡组名
    description TEXT,                        -- 卡组描述，可空
    daily_new_limit INTEGER DEFAULT 20,      -- 每日新卡上限（默认 20）
    created_at  INTEGER NOT NULL,            -- 毫秒时间戳
    updated_at  INTEGER NOT NULL             -- 毫秒时间戳
);

CREATE TABLE IF NOT EXISTS flashcards (
    id              TEXT PRIMARY KEY,         -- UUID
    deck_id         TEXT NOT NULL,            -- 关联 flashcard_decks.id
    uid             TEXT NOT NULL,            -- 冗余存 uid，便于按用户筛选 / 越权校验
    front           TEXT NOT NULL,            -- 卡片正面（Markdown）
    back            TEXT NOT NULL,            -- 卡片背面（Markdown）
    ease_factor     REAL DEFAULT 2.5,         -- SM-2 难度系数，下限 1.3
    interval_days   INTEGER DEFAULT 0,        -- 当前复习间隔天数
    repetitions     INTEGER DEFAULT 0,        -- 连续成功次数
    due_at          INTEGER NOT NULL,         -- 下次到期时间（毫秒）
    is_suspended    INTEGER DEFAULT 0,        -- 是否暂停（1=暂停，不进入复习队列）
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flashcard_reviews (
    id              TEXT PRIMARY KEY,         -- UUID
    card_id         TEXT NOT NULL,            -- 关联 flashcards.id
    uid             TEXT NOT NULL,            -- 冗余存 uid，便于按用户筛选
    grade           INTEGER NOT NULL,         -- 评级：0/3/4/5
    prev_interval   INTEGER,                  -- 复习前 interval_days
    new_interval    INTEGER,                  -- 复习后 interval_days
    reviewed_at     INTEGER NOT NULL,         -- 复习时间（毫秒）
    FOREIGN KEY (card_id) REFERENCES flashcards(id) ON DELETE CASCADE
);


-- 工具特性表里登记闪卡复习入口（与 tools.ts 同步）
-- category_id = 10（AI工具），保持与现有 AI 类目一致；
-- logo 留空，由用户后续放置图片后 UPDATE。
INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('flashcards-2026-08-15', '闪卡复习', '/flashcards/', 10, 'AI工具',
   'Anki 风格间隔重复闪卡复习系统，自录入卡片、按 SM-2 调度到期复习，提升长期记忆效率',
   '', 200, 1, '2026-08-15 10:00:00', '2026-08-15 10:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;