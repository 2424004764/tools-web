-- 四季景色用户数据表
-- 每个用户一行，data 字段存储该用户的自定义地点列表（JSON 字符串）
CREATE TABLE IF NOT EXISTS user_season_scenery (
  id TEXT PRIMARY KEY,               -- 唯一标识符
  uid TEXT NOT NULL,                 -- 用户UID
  data TEXT NOT NULL DEFAULT '[]',   -- 用户地点数据（JSON数组字符串）
  create_time TEXT NOT NULL,         -- 创建时间
  update_time TEXT NOT NULL          -- 更新时间
);

-- 为uid创建唯一索引，保证一个用户只有一条记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_season_scenery_uid ON user_season_scenery(uid);
