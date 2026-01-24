-- 密码管理器数据库表结构
-- 密码分组表
CREATE TABLE IF NOT EXISTS password_groups (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 密码条目表
CREATE TABLE IF NOT EXISTS password_entries (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    title TEXT NOT NULL,
    username TEXT,
    password TEXT NOT NULL,
    url TEXT,
    group_id TEXT,
    notes TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES password_groups(id) ON DELETE SET NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_password_entries_uid ON password_entries(uid);
CREATE INDEX IF NOT EXISTS idx_password_entries_group_id ON password_entries(group_id);
CREATE INDEX IF NOT EXISTS idx_password_groups_uid ON password_groups(uid);
