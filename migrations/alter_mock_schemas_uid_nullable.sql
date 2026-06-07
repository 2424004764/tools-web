-- 修改 mock_schemas 表，允许 uid 为 NULL，支持匿名用户创建配方
-- SQLite 不支持直接 ALTER COLUMN，需要重建表

-- 1. 创建新表结构（uid 允许 NULL）
CREATE TABLE IF NOT EXISTS mock_schemas_new (
    id TEXT PRIMARY KEY,
    uid TEXT,  -- 移除 NOT NULL 约束
    name TEXT NOT NULL,
    description TEXT,
    schema TEXT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 复制现有数据
INSERT INTO mock_schemas_new (id, uid, name, description, schema, create_time, update_time)
SELECT id, uid, name, description, schema, create_time, update_time
FROM mock_schemas;

-- 3. 删除旧表
DROP TABLE mock_schemas;

-- 4. 重命名新表
ALTER TABLE mock_schemas_new RENAME TO mock_schemas;

-- 5. 重建索引
CREATE INDEX IF NOT EXISTS idx_mock_schemas_uid ON mock_schemas(uid);
