-- 身高记录工具：成员表与记录表
-- 字段与 weight_members / weight_records 保持结构对齐，便于共用前端组件范式
-- height: 身高(cm)，保留 1 位小数
-- birth_date: 可选，用于儿童身高预测
-- sex: 可选('male'/'female')，用于身高标准对照

CREATE TABLE IF NOT EXISTS height_members (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  birth_date TEXT,
  sex TEXT,
  goal_height REAL,
  avatar_color TEXT,
  avatar_emoji TEXT,
  is_default INTEGER DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS height_records (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  member_id TEXT NOT NULL,
  height REAL NOT NULL,
  note TEXT,
  record_date TEXT NOT NULL,
  record_time TEXT NOT NULL,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);
