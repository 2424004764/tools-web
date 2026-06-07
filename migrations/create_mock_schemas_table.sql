-- Mock 数据生成器配方表
CREATE TABLE IF NOT EXISTS mock_schemas (
    id TEXT PRIMARY KEY,
    uid TEXT,  -- 允许为 NULL，支持匿名用户创建配方
    name TEXT NOT NULL,
    description TEXT,
    schema TEXT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高按用户查询性能
CREATE INDEX IF NOT EXISTS idx_mock_schemas_uid ON mock_schemas(uid);
