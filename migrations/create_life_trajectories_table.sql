-- 人生轨迹表
-- 存储用户发布的人生轨迹内容，每条记录只能包含文字和表情（mood）
CREATE TABLE IF NOT EXISTS life_trajectories (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,          -- 发布者用户ID（关联 user 表）
    content TEXT NOT NULL,      -- 文本内容（限制 500 字符）
    mood TEXT DEFAULT '🌱',      -- 表情/心情（单个 emoji）
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);